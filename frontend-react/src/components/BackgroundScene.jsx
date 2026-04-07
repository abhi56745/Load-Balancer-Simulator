import React from 'react';
import ParticleNetwork from './ParticleNetwork';

function BackgroundScene({
  mode = 'default',
  simIntensity = 0,
  overloadFactor = 0,
  isActive = false,
}) {
  const isAuth = mode === 'auth';
  const className = isAuth ? 'premium-scene premium-scene-auth' : 'premium-scene';

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        '--sim-intensity': simIntensity,
        '--overload-factor': overloadFactor,
        '--sim-active': isActive ? 1 : 0,
      }}
    >
      <div className="premium-scene-base" />

      <ParticleNetwork
        simIntensity={simIntensity}
        overloadFactor={overloadFactor}
        isActive={isActive}
      />

      <div className="premium-scene-grid" />
      <div className="premium-scene-noise" />
      <div className="premium-scene-glow premium-scene-glow-top" />
      <div className="premium-scene-glow premium-scene-glow-right" />
      <div className="premium-scene-glow premium-scene-glow-bottom" />
      <div className="premium-scene-sheen" />

      <svg className="premium-scene-orbit" viewBox="0 0 900 900" preserveAspectRatio="xMidYMid meet">
        <circle cx="608" cy="284" r="194" className="premium-ring premium-ring-strong" />
        <circle cx="608" cy="284" r="244" className="premium-ring premium-ring-soft" />
        <circle cx="608" cy="284" r="292" className="premium-ring premium-ring-dashed premium-spin-slow" />
        <circle cx="608" cy="284" r="338" className="premium-ring premium-ring-faint" />

        <path d="M408 490 C476 414 540 354 608 284" className="premium-axis" />
        <path d="M608 284 C682 342 748 404 824 462" className="premium-axis premium-axis-amber" />

        <circle cx="608" cy="284" r="9" className="premium-orbit-core" />
        <circle cx="408" cy="490" r="5.5" className="premium-orbit-point" />
        <circle cx="824" cy="462" r="5.5" className="premium-orbit-point premium-orbit-point-amber" />
      </svg>

      <svg className="premium-scene-contours" viewBox="0 0 1200 900" preserveAspectRatio="none">
        <path d="M-40 786 C128 620 292 608 446 520 C596 434 690 280 826 176" className="premium-contour" />
        <path d="M-18 834 C154 668 318 654 474 568 C634 480 720 314 858 204" className="premium-contour premium-contour-soft" />
        <path d="M36 882 C198 722 360 704 516 620 C674 536 774 366 910 248" className="premium-contour premium-contour-faint" />
      </svg>

      <svg className="premium-scene-routing" viewBox="0 0 1440 960" preserveAspectRatio="none">
        <path d="M-60 780 C212 690 394 602 602 428 C814 252 1046 180 1480 114" className="premium-route premium-route-base" />
        <path d="M-100 850 C168 738 356 640 560 480 C756 328 978 262 1320 234" className="premium-route premium-route-soft" />
        <path d="M996 92 C924 188 902 286 962 378 C1022 470 1130 544 1274 626" className="premium-route premium-route-amber-base" />

        <path
          d="M-60 780 C212 690 394 602 602 428 C814 252 1046 180 1480 114"
          pathLength="100"
          className="premium-trace premium-trace-cyan"
          style={{ '--trace-duration': '16s', '--trace-delay': '-1.8s' }}
        />
        <path
          d="M-100 850 C168 738 356 640 560 480 C756 328 978 262 1320 234"
          pathLength="100"
          className="premium-trace premium-trace-blue"
          style={{ '--trace-duration': '14.4s', '--trace-delay': '-5.4s' }}
        />
        <path
          d="M996 92 C924 188 902 286 962 378 C1022 470 1130 544 1274 626"
          pathLength="100"
          className="premium-trace premium-trace-amber"
          style={{ '--trace-duration': '11.8s', '--trace-delay': '-3.7s' }}
        />

        <circle cx="602" cy="428" r="4.8" className="premium-anchor" />
        <circle cx="996" cy="92" r="4.2" className="premium-anchor premium-anchor-soft" />
        <circle cx="962" cy="378" r="4.8" className="premium-anchor premium-anchor-amber" />
      </svg>

      <div className="premium-scene-vignette" />
    </div>
  );
}

export default BackgroundScene;
