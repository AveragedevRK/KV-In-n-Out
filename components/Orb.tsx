import React, { useEffect, useRef } from 'react';

interface OrbProps {
  hue?: number;
  size?: number;
  speed?: number;
  className?: string;
}

export const Orb: React.FC<OrbProps> = ({ 
  hue = 270, 
  size = 600, 
  speed = 0.005,
  className = "" 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;
    
    // Set canvas size
    const updateSize = () => {
        canvas.width = size;
        canvas.height = size;
    };
    updateSize();

    const draw = () => {
      time += speed;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Liquid movement: oscillate radius and center slightly
      const radiusBase = canvas.width / 3;
      const radiusOscillation = Math.sin(time * 2) * (radiusBase * 0.1);
      const radius = radiusBase + radiusOscillation;

      const gradientX = centerX + Math.cos(time) * 40;
      const gradientY = centerY + Math.sin(time * 1.5) * 40;

      const gradient = ctx.createRadialGradient(
        gradientX, 
        gradientY, 
        0, 
        centerX, 
        centerY, 
        radius * 1.5
      );

      // Core color
      gradient.addColorStop(0, `hsla(${hue}, 85%, 65%, 0.8)`);
      // Mid glow with slight color shift
      gradient.addColorStop(0.5, `hsla(${hue + 30}, 75%, 50%, 0.3)`);
      // Outer fade
      gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');

      ctx.fillStyle = gradient;
      // High blur for liquid blending
      ctx.filter = 'blur(60px)';
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [hue, size, speed]);

  return (
    <div 
      ref={containerRef} 
      className={`pointer-events-none absolute opacity-80 mix-blend-screen will-change-transform ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};