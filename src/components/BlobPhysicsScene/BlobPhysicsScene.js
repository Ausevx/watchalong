'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import styles from '@/app/page.module.css';

export default function BlobPhysicsScene() {
  const blob1Ref = useRef(null);
  const blob2Ref = useRef(null);
  const blob3Ref = useRef(null);

  useEffect(() => {
    const blobs = [
      { el: blob1Ref.current, x: 0, y: 0, vx: 0, vy: 0, mass: 1, radius: 1, baseCX: 0, baseCY: 0, isDragging: false, hasDragged: false },
      { el: blob2Ref.current, x: 0, y: 0, vx: 0, vy: 0, mass: 1, radius: 1, baseCX: 0, baseCY: 0, isDragging: false, hasDragged: false },
      { el: blob3Ref.current, x: 0, y: 0, vx: 0, vy: 0, mass: 1, radius: 1, baseCX: 0, baseCY: 0, isDragging: false, hasDragged: false }
    ].filter(b => b.el);

    const updateBaseMeasurements = () => {
      blobs.forEach(b => {
        const currentTransform = b.el.style.transform;
        const currentAnim = b.el.style.animation;
        
        b.el.style.transform = 'none';
        b.el.style.animation = 'none';
        
        const rect = b.el.getBoundingClientRect();
        b.baseCX = rect.left + rect.width / 2;
        b.baseCY = rect.top + rect.height / 2;
        b.radius = rect.width / 2;
        b.mass = b.radius; // larger blobs are heavier
        
        b.el.style.transform = currentTransform;
        b.el.style.animation = currentAnim;
      });
    };

    updateBaseMeasurements();
    window.addEventListener('resize', updateBaseMeasurements);

    let rafId;

    const updatePlay = () => {
      // 1. Friction & movement
      blobs.forEach(b => {
        if (b.hasDragged && !b.isDragging) {
          b.vx *= 0.985;
          b.vy *= 0.985;

          if (Math.abs(b.vx) < 0.05) b.vx = 0;
          if (Math.abs(b.vy) < 0.05) b.vy = 0;

          b.x += b.vx;
          b.y += b.vy;
        }
      });

      // 2. Wall collision & penetration resolution
      blobs.forEach(b => {
        if (!b.hasDragged || b.isDragging) return;

        let cx = b.baseCX + b.x;
        let cy = b.baseCY + b.y;
        let hit = false;
        const bounce = -0.7; // lose 30% speed on wall hit

        if (cx - b.radius < 0) {
          cx = b.radius; b.vx *= bounce; hit = true;
        } else if (cx + b.radius > window.innerWidth) {
          cx = window.innerWidth - b.radius; b.vx *= bounce; hit = true;
        }

        if (cy - b.radius < 0) {
          cy = b.radius; b.vy *= bounce; hit = true;
        } else if (cy + b.radius > window.innerHeight) {
          cy = window.innerHeight - b.radius; b.vy *= bounce; hit = true;
        }

        b.x = cx - b.baseCX;
        b.y = cy - b.baseCY;

        if (hit && Math.hypot(b.vx, b.vy) > 8) {
          confetti({
            particleCount: 15, spread: 50, zIndex: 100,
            origin: { x: cx / window.innerWidth, y: Math.min(1, cy / window.innerHeight) }
          });
        }
      });

      // 3. Blob-blob collision
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const b1 = blobs[i];
          const b2 = blobs[j];

          // If neither has been interacted with, their CSS float animation handles them
          if (!b1.hasDragged && !b2.hasDragged) continue;

          let cx1 = b1.baseCX + b1.x;
          let cy1 = b1.baseCY + b1.y;
          let cx2 = b2.baseCX + b2.x;
          let cy2 = b2.baseCY + b2.y;

          let dx = cx2 - cx1;
          let dy = cy2 - cy1;
          let dist = Math.hypot(dx, dy);
          let minDist = b1.radius + b2.radius;

          if (dist < minDist) {
            let overlap = minDist - dist;
            let nx = dx / dist;
            let ny = dy / dist;

            let totalMass = b1.mass + b2.mass;
            let m1Ratio = b2.mass / totalMass;
            let m2Ratio = b1.mass / totalMass;

            // Resolve penetration
            if (!b1.isDragging && b1.hasDragged) {
              b1.x -= nx * overlap * m1Ratio;
              b1.y -= ny * overlap * m1Ratio;
            }
            if (!b2.isDragging && b2.hasDragged) {
              b2.x += nx * overlap * m2Ratio;
              b2.y += ny * overlap * m2Ratio;
            }

            // Exchange velocity
            let rvx = b2.vx - b1.vx;
            let rvy = b2.vy - b1.vy;
            let velAlongNormal = rvx * nx + rvy * ny;

            if (velAlongNormal < 0) {
              let restitution = 0.8;
              let j_impulse = -(1 + restitution) * velAlongNormal / (1 / b1.mass + 1 / b2.mass);

              let impulseX = j_impulse * nx;
              let impulseY = j_impulse * ny;

              if (!b1.isDragging && b1.hasDragged) {
                b1.vx -= impulseX / b1.mass;
                b1.vy -= impulseY / b1.mass;
              }
              if (!b2.isDragging && b2.hasDragged) {
                b2.vx += impulseX / b2.mass;
                b2.vy += impulseY / b2.mass;
              }

              // Confetti on hard impact
              if (Math.abs(j_impulse) > 150) {
                confetti({
                  particleCount: 25, spread: 80, zIndex: 100,
                  origin: { x: (cx1 + cx2) / 2 / window.innerWidth, y: (cy1 + cy2) / 2 / window.innerHeight }
                });
              }
            }
          }
        }
      }

      // 4. Apply Transforms
      blobs.forEach(b => {
        if (b.hasDragged) {
          b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
        }
      });

      rafId = requestAnimationFrame(updatePlay);
    };

    rafId = requestAnimationFrame(updatePlay);

    // Bind event listeners
    const handlers = [];
    blobs.forEach(b => {
      let lastM = { x: 0, y: 0 };
      
      const down = (e) => {
        b.isDragging = true;
        // On first interaction, kill CSS float animation permanently
        if (!b.hasDragged) {
          b.el.style.animation = 'none';
          
          // Re-measure accurately once the CSS animation is purged to get exact screen origin
          const rect = b.el.getBoundingClientRect();
          b.baseCX = rect.left + rect.width / 2;
          b.baseCY = rect.top + rect.height / 2;
        }
        b.hasDragged = true;
        
        b.vx = 0; b.vy = 0;
        lastM = { x: e.clientX, y: e.clientY };
        b.el.setPointerCapture(e.pointerId);
        
        // Boost z-index to bring it to front while dragging
        b.el.style.zIndex = '999';
        e.preventDefault();
      };
      
      const move = (e) => {
        if (!b.isDragging) return;
        let dx = e.clientX - lastM.x;
        let dy = e.clientY - lastM.y;
        b.x += dx;
        b.y += dy;
        b.vx = dx;
        b.vy = dy;
        lastM = { x: e.clientX, y: e.clientY };
      };
      
      const up = (e) => {
        if (!b.isDragging) return;
        b.isDragging = false;
        b.el.releasePointerCapture(e.pointerId);
        b.el.style.zIndex = '50'; // Reset to standard interactable z-index
      };
      
      b.el.addEventListener('pointerdown', down);
      b.el.addEventListener('pointermove', move);
      b.el.addEventListener('pointerup', up);
      b.el.addEventListener('pointercancel', up);

      b.el.style.touchAction = 'none';
      b.el.style.cursor = 'grab';

      handlers.push({ el: b.el, down, move, up });
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateBaseMeasurements);
      handlers.forEach(({ el, down, move, up }) => {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      });
    };
  }, []);

  return (
    <>
      <div ref={blob1Ref} className={`${styles.blob} ${styles.blob1}`} />
      <div ref={blob2Ref} className={`${styles.blob} ${styles.blob2}`} />
      <div ref={blob3Ref} className={`${styles.blob} ${styles.blob3}`} />
    </>
  );
}
