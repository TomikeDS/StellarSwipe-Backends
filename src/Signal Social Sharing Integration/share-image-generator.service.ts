import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, registerFont } from 'canvas';
import * as path from 'path';
import * as fs from 'fs';

export interface SignalImageData {
  signalId: string;
  pair: string;         // e.g. 'USDC/XLM'
  pnlPercent: number;   // e.g. 15.3
  providerName: string;
  entryPrice: number;
  exitPrice: number;
  tradeType: 'BUY' | 'SELL';
  timestamp: Date;
}

@Injectable()
export class ShareImageGeneratorService {
  private readonly logger = new Logger(ShareImageGeneratorService.name);
  private readonly outputDir = path.join(process.cwd(), 'public', 'share-images');

  constructor() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateShareImage(data: SignalImageData): Promise<string> {
    try {
      const width = 1200;
      const height = 630;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#0a0f1e');
      gradient.addColorStop(1, '#1a1f3e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Decorative grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 60) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 60) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Glow effect behind P&L
      const isProfit = data.pnlPercent >= 0;
      const glowColor = isProfit ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 59, 59, 0.12)';
      const radialGrad = ctx.createRadialGradient(600, 315, 50, 600, 315, 350);
      radialGrad.addColorStop(0, glowColor);
      radialGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, width, height);

      // Card background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      (ctx as any).roundRect(60, 60, 1080, 510, 24);
      ctx.fill();

      // Border
      ctx.strokeStyle = isProfit ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 59, 59, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      (ctx as any).roundRect(60, 60, 1080, 510, 24);
      ctx.stroke();

      // StellarSwipe branding - top left
      ctx.fillStyle = '#7c6dfa';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('⭐ StellarSwipe', 100, 130);

      // Provider name
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '20px Arial';
      ctx.fillText(`Signal by ${data.providerName}`, 100, 165);

      // Pair badge
      ctx.fillStyle = 'rgba(124, 109, 250, 0.2)';
      ctx.beginPath();
      (ctx as any).roundRect(100, 190, 160, 44, 8);
      ctx.fill();
      ctx.strokeStyle = '#7c6dfa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      (ctx as any).roundRect(100, 190, 160, 44, 8);
      ctx.stroke();
      ctx.fillStyle = '#7c6dfa';
      ctx.font = 'bold 22px Arial';
      ctx.fillText(data.pair, 120, 220);

      // Trade type badge
      const badgeColor = data.tradeType === 'BUY' ? '#00c076' : '#ff3b3b';
      ctx.fillStyle = badgeColor + '33';
      ctx.beginPath();
      (ctx as any).roundRect(280, 190, 80, 44, 8);
      ctx.fill();
      ctx.strokeStyle = badgeColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      (ctx as any).roundRect(280, 190, 80, 44, 8);
      ctx.stroke();
      ctx.fillStyle = badgeColor;
      ctx.font = 'bold 20px Arial';
      ctx.fillText(data.tradeType, 300, 220);

      // P&L percentage - big and bold
      const pnlColor = isProfit ? '#00ff88' : '#ff3b3b';
      const pnlText = `${isProfit ? '+' : ''}${data.pnlPercent.toFixed(2)}%`;
      ctx.fillStyle = pnlColor;
      ctx.font = 'bold 120px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(pnlText, 600, 380);

      // P&L label
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '24px Arial';
      ctx.fillText('PROFIT / LOSS', 600, 420);

      // Entry / Exit prices
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '20px Arial';
      ctx.fillText('Entry Price', 100, 460);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Arial';
      ctx.fillText(`$${data.entryPrice.toFixed(6)}`, 100, 495);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '20px Arial';
      ctx.fillText('Exit Price', 400, 460);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px Arial';
      ctx.fillText(`$${data.exitPrice.toFixed(6)}`, 400, 495);

      // Date
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '18px Arial';
      ctx.fillText(
        new Date(data.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        1100,
        495,
      );

      // Watermark tagline
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '16px Arial';
      ctx.fillText('Copy the best traders on Stellar · stellarswipe.io', 600, 545);

      // Save file
      const fileName = `signal-${data.signalId}-${Date.now()}.png`;
      const filePath = path.join(this.outputDir, fileName);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(filePath, buffer);

      return `/share-images/${fileName}`;
    } catch (error) {
      this.logger.error(`Failed to generate share image: ${error.message}`, error.stack);
      throw new Error('Image generation failed');
    }
  }

  deleteImage(imageUrl: string): void {
    try {
      const fileName = imageUrl.replace('/share-images/', '');
      const filePath = path.join(this.outputDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete image: ${error.message}`);
    }
  }
}
