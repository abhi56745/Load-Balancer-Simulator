import React, { useRef, useEffect, useCallback } from 'react';

const PARTICLE_COUNT = 72;
const CONNECTION_DISTANCE = 160;
const MOUSE_RADIUS = 200;
const BASE_SPEED = 0.25;

function createParticle(width, height) {
  const angle = Math.random() * Math.PI * 2;
  const speed = BASE_SPEED + Math.random() * 0.35;

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    baseRadius: 1.4 + Math.random() * 2,
    radius: 1.4 + Math.random() * 2,
    pulseOffset: Math.random() * Math.PI * 2,
    hue: Math.random() > 0.82 ? 38 : (185 + Math.random() * 15),
    opacity: 0.5 + Math.random() * 0.5,
  };
}

function ParticleNetwork({ simIntensity = 0, overloadFactor = 0, isActive = false }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const frameRef = useRef(0);
  const propsRef = useRef({ simIntensity, overloadFactor, isActive });

  propsRef.current = { simIntensity, overloadFactor, isActive };

  const initParticles = useCallback((width, height) => {
    const particles = [];

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      particles.push(createParticle(width, height));
    }

    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    let animationId;
    let width;
    let height;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particlesRef.current.length === 0) {
        initParticles(width, height);
      }
    };

    const handleMouseMove = (event) => {
      mouseRef.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    const draw = () => {
      const { simIntensity: intensity, overloadFactor: overload, isActive: active } = propsRef.current;
      const time = frameRef.current * 0.016;

      frameRef.current += 1;
      ctx.clearRect(0, 0, width, height);

      const speedMultiplier = 1 + intensity * 1.8;
      const connectionAlpha = 0.08 + intensity * 0.14;
      const glowStrength = active ? 0.6 + intensity * 0.4 : 0.35;
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];

        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        if (p.x < -20) {
          p.x = width + 20;
        }

        if (p.x > width + 20) {
          p.x = -20;
        }

        if (p.y < -20) {
          p.y = height + 20;
        }

        if (p.y > height + 20) {
          p.y = -20;
        }

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS) {
          const force = (1 - dist / MOUSE_RADIUS) * 0.6;
          p.x -= dx * force * 0.02;
          p.y -= dy * force * 0.02;
        }

        const pulse = Math.sin(time * 1.2 + p.pulseOffset) * 0.5 + 0.5;
        p.radius = p.baseRadius + pulse * 1.2 + (active ? intensity * 1.5 : 0);

        let hue = p.hue;

        if (overload > 0.3 && p.hue > 100) {
          hue = p.hue - (p.hue - 15) * overload * 0.7;
        }

        const sat = p.hue < 100 ? '90%' : `${80 + overload * 15}%`;
        const light = p.hue < 100 ? '60%' : `${68 + pulse * 12}%`;
        const alpha = p.opacity * glowStrength;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${sat}, ${light}, ${alpha * 0.25})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, ${sat}, ${light}, ${alpha})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * connectionAlpha;
            const isWarm = a.hue < 100 || b.hue < 100;
            let lineHue = 192;

            if (isWarm) {
              lineHue = 38;
            } else if (overload > 0.4) {
              lineHue = 192 - (192 - 20) * overload * 0.5;
            }

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `hsla(${lineHue}, 85%, 65%, ${alpha})`;
            ctx.lineWidth = 0.6 + (active ? intensity * 0.6 : 0);
            ctx.stroke();
          }
        }
      }

      if (active && intensity > 0.05) {
        const pulseNodes = Math.floor(intensity * 6) + 1;

        for (let i = 0; i < Math.min(pulseNodes, particles.length); i += 1) {
          const p = particles[i];
          const pulseRadius = 8 + Math.sin(time * 3 + i) * 4 + intensity * 12;
          const pulseAlpha = (0.06 + intensity * 0.08) * (0.5 + Math.sin(time * 2 + i * 1.5) * 0.5);

          ctx.beginPath();
          ctx.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2);
          ctx.fillStyle = overload > 0.5
            ? `hsla(15, 95%, 55%, ${pulseAlpha})`
            : `hsla(185, 95%, 65%, ${pulseAlpha})`;
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="particle-network-canvas"
      aria-hidden="true"
    />
  );
}

export default ParticleNetwork;
