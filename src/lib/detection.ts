import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { ViolationType } from '@/types/proctoring';

export class ProctoringDetector {
  private faceDetector: blazeface.BlazeFaceModel | null = null;
  private objectDetector: cocoSsd.ObjectDetection | null = null;
  private isInitialized = false;
  private useBackupDetection = false;
  private previousFrame: ImageData | null = null;
  private isProduction = process.env.NODE_ENV === 'production';

  async initialize() {
    try {
      if (!this.isProduction) {
        console.log('Initializing TensorFlow.js models...');
      }
      
      // Initialize TensorFlow.js backend with timeout
      const initTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Model loading timeout')), 30000)
      );
      
      await Promise.race([tf.ready(), initTimeout]);
      
      if (!this.isProduction) {
        console.log('TensorFlow.js backend:', tf.getBackend());
      }

      // Load models in parallel with retry logic
      const loadPromises = [
        this.loadFaceDetectionModel(),
        this.loadObjectDetectionModel()
      ];

      const results = await Promise.allSettled(loadPromises);
      
      let modelLoadCount = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          modelLoadCount++;
          if (!this.isProduction) {
            console.log(`Model ${index + 1} loaded successfully`);
          }
        } else {
          console.warn(`Model ${index + 1} failed to load:`, result.reason);
        }
      });

      if (modelLoadCount === 0) {
        console.warn('All TensorFlow.js models failed to load, using backup detection methods');
        this.useBackupDetection = true;
      } else {
        if (!this.isProduction) {
          console.log(`${modelLoadCount}/2 TensorFlow.js models loaded successfully`);
        }
      }

      this.isInitialized = true;
      if (!this.isProduction) {
        console.log('Detection system initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js detection system:', error);
      this.useBackupDetection = true;
      this.isInitialized = true;
      throw new Error('AI detection system initialization failed');
    }
  }

  private async loadFaceDetectionModel() {
    try {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Face model loading timeout')), 15000)
      );
      
      this.faceDetector = await Promise.race([blazeface.load(), timeout]) as blazeface.BlazeFaceModel;
      
      if (!this.isProduction) {
        console.log('BlazeFace model loaded');
      }
    } catch (error) {
      console.error('Failed to load BlazeFace model:', error);
      throw error;
    }
  }

  private async loadObjectDetectionModel() {
    try {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Object model loading timeout')), 15000)
      );
      
      this.objectDetector = await Promise.race([cocoSsd.load(), timeout]) as cocoSsd.ObjectDetection;
      
      if (!this.isProduction) {
        console.log('COCO-SSD model loaded');
      }
    } catch (error) {
      console.error('Failed to load COCO-SSD model:', error);
      throw error;
    }
  }


  async detectFaces(imageElement: HTMLImageElement) {
    if (!this.isInitialized) {
      throw new Error('Detector not initialized');
    }

    if (this.useBackupDetection || !this.faceDetector) {
      return this.detectFacesBackup(imageElement);
    }

    try {
      if (!this.isProduction) {
        console.log('Starting TensorFlow.js face detection...');
      }
      const predictions = await this.faceDetector.estimateFaces(imageElement, false);
      
      if (!this.isProduction) {
        console.log('TensorFlow.js Face detection results:', { 
          totalFaces: predictions.length,
          predictions: predictions.map(p => ({ 
            probability: p.probability,
            topLeft: p.topLeft,
            bottomRight: p.bottomRight 
          }))
        });
      }
      
      // Filter faces by confidence (probability)
      const validFaces = predictions.filter(face => {
        const prob = Array.isArray(face.probability) ? face.probability[0] : face.probability;
        return typeof prob === 'number' ? prob > 0.7 : true;
      });
      
      return {
        count: validFaces.length,
        faces: validFaces.map(face => ({
          box: {
            xmin: face.topLeft[0] / imageElement.width,
            ymin: face.topLeft[1] / imageElement.height,
            xmax: face.bottomRight[0] / imageElement.width,
            ymax: face.bottomRight[1] / imageElement.height
          },
          probability: face.probability,
          landmarks: face.landmarks
        })),
        hasFace: validFaces.length > 0,
        multipleFaces: validFaces.length > 1
      };
    } catch (error) {
      console.error('TensorFlow.js face detection error, falling back to backup method:', error);
      return this.detectFacesBackup(imageElement);
    }
  }

  private detectFacesBackup(imageElement: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { count: 0, faces: [], hasFace: false, multipleFaces: false };

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasMotion = this.detectMotion(imageData);
    const centerRegion = this.analyzeCenterRegion(imageData);
    const faceRegions = this.detectFaceRegions(imageData);
    
    const hasFace = hasMotion && (centerRegion.hasSignificantContent || faceRegions.length > 0);
    const faceCount = faceRegions.length > 0 ? faceRegions.length : (hasFace ? 1 : 0);
    
    if (!this.isProduction) {
      console.log('Backup face detection:', { 
        hasMotion, 
        centerRegion: centerRegion.hasSignificantContent, 
        faceRegions: faceRegions.length,
        hasFace: hasFace,
        finalCount: faceCount 
      });
    }
    
    return {
      count: faceCount,
      faces: faceRegions.length > 0 ? faceRegions : (hasFace ? [{ box: { xmin: 0.25, ymin: 0.25, xmax: 0.75, ymax: 0.75 } }] : []),
      hasFace: hasFace,
      multipleFaces: faceCount > 1
    };
  }

  async detectObjects(imageElement: HTMLImageElement) {
    if (!this.isInitialized) {
      throw new Error('Object detector not initialized');
    }

    if (this.useBackupDetection || !this.objectDetector) {
      return this.detectObjectsBackup(imageElement);
    }

    try {
      if (!this.isProduction) {
        console.log('Starting TensorFlow.js object detection...');
      }
      const predictions = await this.objectDetector.detect(imageElement);
      
      // Define suspicious objects with their COCO class names
      const suspiciousObjects = [
        'cell phone', 'book', 'laptop', 'mouse', 'keyboard', 
        'remote', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
      ];

      const detectedSuspiciousObjects = predictions
        .filter(prediction => 
          suspiciousObjects.some(obj => 
            prediction.class.toLowerCase().includes(obj) ||
            obj.includes(prediction.class.toLowerCase())
          ) && prediction.score > 0.4
        )
        .map(prediction => ({
          object: prediction.class,
          confidence: prediction.score,
          box: {
            xmin: prediction.bbox[0] / imageElement.width,
            ymin: prediction.bbox[1] / imageElement.height,
            xmax: (prediction.bbox[0] + prediction.bbox[2]) / imageElement.width,
            ymax: (prediction.bbox[1] + prediction.bbox[3]) / imageElement.height
          }
        }));

      if (!this.isProduction) {
        console.log('TensorFlow.js Object detection results:', {
          totalObjects: predictions.length,
          suspiciousObjects: detectedSuspiciousObjects.length,
          detected: detectedSuspiciousObjects.map(obj => ({ 
            object: obj.object, 
            confidence: obj.confidence 
          }))
        });
      }

      return detectedSuspiciousObjects;
    } catch (error) {
      console.error('TensorFlow.js object detection error, using backup method:', error);
      return this.detectObjectsBackup(imageElement);
    }
  }

  async analyzeLookingDirection(face: any): Promise<{ isLookingAway: boolean; confidence: number }> {
    // Simplified gaze estimation based on face position and size
    return this.analyzeLookingDirectionBasic(face);
  }

  private calculateEyeCenter(eyeLandmarks: number[][]) {
    if (!eyeLandmarks || eyeLandmarks.length === 0) return null;
    
    let sumX = 0, sumY = 0;
    eyeLandmarks.forEach(landmark => {
      sumX += landmark[0];
      sumY += landmark[1];
    });
    
    return {
      x: sumX / eyeLandmarks.length,
      y: sumY / eyeLandmarks.length
    };
  }

  private analyzeLookingDirectionBasic(face: any): { isLookingAway: boolean; confidence: number } {
    if (!face || !face.box) {
      return { isLookingAway: true, confidence: 0.8 };
    }

    const faceCenter = {
      x: face.box.xmin + (face.box.xmax - face.box.xmin) / 2,
      y: face.box.ymin + (face.box.ymax - face.box.ymin) / 2
    };

    const screenCenter = { x: 0.5, y: 0.5 };
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(faceCenter.x - screenCenter.x, 2) + 
      Math.pow(faceCenter.y - screenCenter.y, 2)
    );

    const threshold = this.useBackupDetection ? 0.4 : 0.3;
    const isLookingAway = distanceFromCenter > threshold;
    const confidence = Math.min(distanceFromCenter * 2, 1);

    if (!this.isProduction) {
      console.log('Basic gaze analysis:', { 
        faceCenter, 
        distanceFromCenter, 
        threshold, 
        isLookingAway, 
        confidence 
      });
    }

    return { isLookingAway, confidence };
  }

  private detectMotion(currentImageData: ImageData): boolean {
    if (!this.previousFrame) {
      this.previousFrame = currentImageData;
      return true;
    }

    const current = currentImageData.data;
    const previous = this.previousFrame.data;
    let totalDiff = 0;
    const threshold = 30;
    let changedPixels = 0;

    for (let i = 0; i < current.length; i += 4) {
      const rDiff = Math.abs(current[i] - previous[i]);
      const gDiff = Math.abs(current[i + 1] - previous[i + 1]);
      const bDiff = Math.abs(current[i + 2] - previous[i + 2]);
      const pixelDiff = (rDiff + gDiff + bDiff) / 3;
      
      if (pixelDiff > threshold) {
        changedPixels++;
        totalDiff += pixelDiff;
      }
    }

    this.previousFrame = currentImageData;
    const motionPercentage = (changedPixels / (current.length / 4)) * 100;
    return motionPercentage > 0.5;
  }

  private analyzeCenterRegion(imageData: ImageData) {
    const { width, height, data } = imageData;
    const centerX = width / 2;
    const centerY = height / 2;
    const regionSize = Math.min(width, height) * 0.3;
    
    let totalBrightness = 0;
    let pixelCount = 0;
    
    for (let y = centerY - regionSize/2; y < centerY + regionSize/2; y++) {
      for (let x = centerX - regionSize/2; x < centerX + regionSize/2; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (Math.floor(y) * width + Math.floor(x)) * 4;
          const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
          totalBrightness += brightness;
          pixelCount++;
        }
      }
    }
    
    const avgBrightness = totalBrightness / pixelCount;
    return {
      hasSignificantContent: avgBrightness > 50 && avgBrightness < 200,
      brightness: avgBrightness
    };
  }

  private detectFaceRegions(imageData: ImageData) {
    const faceRegions = [];
    const skinColorRegions = this.detectSkinColorRegions(imageData);
    const mergedRegions = this.mergeNearbyRegions(skinColorRegions);
    
    if (mergedRegions.length > 1 && this.hasSignificantSeparation(mergedRegions)) {
      mergedRegions.forEach((region, index) => {
        faceRegions.push({ 
          box: { 
            xmin: region.x / imageData.width, 
            ymin: region.y / imageData.height, 
            xmax: (region.x + region.w) / imageData.width, 
            ymax: (region.y + region.h) / imageData.height 
          } 
        });
      });
    } else if (mergedRegions.length >= 1) {
      faceRegions.push({ box: { xmin: 0.25, ymin: 0.25, xmax: 0.75, ymax: 0.75 } });
    }
    
    return faceRegions;
  }

  private detectSkinColorRegions(imageData: ImageData) {
    const { width, height, data } = imageData;
    const skinRegions = [];
    
    const gridSize = 3;
    const sectionWidth = width / gridSize;
    const sectionHeight = height / gridSize;
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const startX = col * sectionWidth;
        const startY = row * sectionHeight;
        const endX = Math.min(startX + sectionWidth, width);
        const endY = Math.min(startY + sectionHeight, height);
        
        let skinPixelCount = 0;
        let totalPixels = 0;
        
        for (let y = startY; y < endY; y += 3) {
          for (let x = startX; x < endX; x += 3) {
            const i = (Math.floor(y) * width + Math.floor(x)) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            if (r > 95 && g > 40 && b > 20 && 
                Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                Math.abs(r - g) > 15 && r > g && r > b &&
                r < 255 && g < 255 && b < 255) {
              skinPixelCount++;
            }
            totalPixels++;
          }
        }
        
        const skinPercentage = (skinPixelCount / totalPixels) * 100;
        if (skinPercentage > 15 && (row === 1 || col === 1)) { 
          skinRegions.push({ 
            x: startX, 
            y: startY, 
            w: endX - startX, 
            h: endY - startY,
            skinPercentage 
          });
        }
      }
    }
    
    return skinRegions;
  }

  private mergeNearbyRegions(regions: any[]) {
    if (regions.length <= 1) return regions;
    
    const merged = [];
    const used = new Set();
    
    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) continue;
      
      let currentRegion = { ...regions[i] };
      used.add(i);
      
      for (let j = i + 1; j < regions.length; j++) {
        if (used.has(j)) continue;
        
        const distance = Math.sqrt(
          Math.pow(regions[i].x - regions[j].x, 2) + 
          Math.pow(regions[i].y - regions[j].y, 2)
        );
        
        if (distance < 100) {
          currentRegion = this.mergeRegions(currentRegion, regions[j]);
          used.add(j);
        }
      }
      
      merged.push(currentRegion);
    }
    
    return merged;
  }

  private mergeRegions(region1: any, region2: any) {
    const minX = Math.min(region1.x, region2.x);
    const minY = Math.min(region1.y, region2.y);
    const maxX = Math.max(region1.x + region1.w, region2.x + region2.w);
    const maxY = Math.max(region1.y + region1.h, region2.y + region2.h);
    
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      skinPercentage: Math.max(region1.skinPercentage, region2.skinPercentage)
    };
  }

  private hasSignificantSeparation(regions: any[]) {
    if (regions.length <= 1) return false;
    
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const distance = Math.sqrt(
          Math.pow(regions[i].x - regions[j].x, 2) + 
          Math.pow(regions[i].y - regions[j].y, 2)
        );
        
        if (distance < 150) {
          return false;
        }
      }
    }
    
    return true;
  }

  private detectObjectsBackup(imageElement: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const suspiciousObjects = [];

    const rectangularObjects = this.detectRectangularObjects(imageData);
    if (rectangularObjects.length > 0) {
      const edges = this.detectEdges(imageData);
      if (edges.hasStrongEdges && edges.edgePercentage > 10) {
        suspiciousObjects.push({
          object: 'suspected device',
          confidence: 0.6,
          box: rectangularObjects[0]
        });
      }
    }

    const phoneIndicators = this.detectPhoneLikeObjects(imageData);
    if (phoneIndicators.hasPhoneLikeObject) {
      suspiciousObjects.push({
        object: 'phone',
        confidence: phoneIndicators.confidence,
        box: phoneIndicators.box
      });
    }

    return suspiciousObjects;
  }

  private detectPhoneLikeObjects(imageData: ImageData) {
    const { width, height, data } = imageData;
    
    let darkRectangularAreas = 0;
    let metallicColorCount = 0;
    let screenLikeAreas = 0;
    
    const gridSize = 8;
    const sectionWidth = width / gridSize;
    const sectionHeight = height / gridSize;
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const startX = col * sectionWidth;
        const startY = row * sectionHeight;
        
        const regionAnalysis = this.analyzeRegionForPhone(imageData, startX, startY, sectionWidth, sectionHeight);
        
        if (regionAnalysis.isDarkRectangular) darkRectangularAreas++;
        if (regionAnalysis.hasMetallicColors) metallicColorCount++;
        if (regionAnalysis.isScreenLike) screenLikeAreas++;
      }
    }
    
    const phoneScore = (darkRectangularAreas * 0.4 + metallicColorCount * 0.3 + screenLikeAreas * 0.3) / (gridSize * gridSize);
    
    return {
      hasPhoneLikeObject: phoneScore > 0.15,
      confidence: Math.min(phoneScore * 2, 0.8),
      box: { xmin: 0.3, ymin: 0.3, xmax: 0.7, ymax: 0.7 }
    };
  }

  private analyzeRegionForPhone(imageData: ImageData, startX: number, startY: number, width: number, height: number) {
    const { data } = imageData;
    let darkPixels = 0;
    let metallicPixels = 0;
    let screenPixels = 0;
    let totalPixels = 0;
    
    for (let y = startY; y < startY + height && y < imageData.height; y += 2) {
      for (let x = startX; x < startX + width && x < imageData.width; x += 2) {
        const i = (Math.floor(y) * imageData.width + Math.floor(x)) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const brightness = (r + g + b) / 3;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        
        if (brightness < 80) darkPixels++;
        if (saturation < 30 && brightness > 100 && brightness < 180) metallicPixels++;
        if ((b > r && b > g) || (r > 200 && g > 200 && b > 200)) screenPixels++;
        
        totalPixels++;
      }
    }
    
    return {
      isDarkRectangular: (darkPixels / totalPixels) > 0.6,
      hasMetallicColors: (metallicPixels / totalPixels) > 0.3,
      isScreenLike: (screenPixels / totalPixels) > 0.4
    };
  }

  private detectRectangularObjects(imageData: ImageData) {
    const objects = [];
    const edges = this.detectEdges(imageData);
    if (edges.hasStrongEdges) {
      objects.push({
        xmin: 0.2,
        ymin: 0.2,
        xmax: 0.4,
        ymax: 0.6
      });
    }
    return objects;
  }

  private detectEdges(imageData: ImageData) {
    const { width, height, data } = imageData;
    let edgeCount = 0;
    const threshold = 50;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = (y * width + x) * 4;
        const right = center + 4;
        const bottom = ((y + 1) * width + x) * 4;
        
        const centerGray = (data[center] + data[center + 1] + data[center + 2]) / 3;
        const rightGray = (data[right] + data[right + 1] + data[right + 2]) / 3;
        const bottomGray = (data[bottom] + data[bottom + 1] + data[bottom + 2]) / 3;
        
        const horizontalEdge = Math.abs(centerGray - rightGray);
        const verticalEdge = Math.abs(centerGray - bottomGray);
        
        if (horizontalEdge > threshold || verticalEdge > threshold) {
          edgeCount++;
        }
      }
    }
    
    const edgePercentage = (edgeCount / ((width - 2) * (height - 2))) * 100;
    return {
      hasStrongEdges: edgePercentage > 5,
      edgePercentage
    };
  }

  getDetectionStatus() {
    return {
      isInitialized: this.isInitialized,
      useBackupDetection: this.useBackupDetection,
      hasFaceDetector: !!this.faceDetector,
      hasObjectDetector: !!this.objectDetector,
      tfBackend: tf.getBackend()
    };
  }
}

export const proctoringDetector = new ProctoringDetector();
