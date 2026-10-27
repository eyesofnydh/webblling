/**
 * Webling Webpage Companion (Manifest V3 Content Script)
 * Renders inside an isolated Shadow DOM.
 * Manages character animation, physics, speech, hydration widget,
 * focus indicator, tiny spider rescues, cosmetics, and messaging.
 */

(() => {
  if (window.__weblingLoaded || document.getElementById('webling-extension-root')) {
    return;
  }
  window.__weblingLoaded = true;

  // ---------------------------------------------------------------------------
  // Host & Shadow DOM Setup
  // ---------------------------------------------------------------------------

  const host = document.createElement('div');
  host.id = 'webling-extension-root';
  const shadow = host.attachShadow({ mode: 'closed' });
  document.documentElement.appendChild(host);

  // Focus style element (for non-destructive video dimming during Focus Patrol)
  const focusStyle = document.createElement('style');
  focusStyle.id = 'webling-focus-style';
  focusStyle.textContent = `
    html[data-webling-focus="dim"] video {
      filter: grayscale(.65) contrast(.9) brightness(.75) !important;
      transition: filter 0.5s ease !important;
    }
  `;
  document.documentElement.appendChild(focusStyle);

  const HERO_ASSETS = {
    webling: chrome.runtime.getURL('assets/hero-webling.png'),
    titan: chrome.runtime.getURL('assets/hero-titan.png'),
    stormbringer: chrome.runtime.getURL('assets/hero-stormbringer.png'),
    classic: chrome.runtime.getURL('assets/hero-classic.png'),
  };
  const heroAssetUrl = HERO_ASSETS.webling;

  // ---------------------------------------------------------------------------
  // Dialogue Data (Inlined for Content Script Isolation)
  // ---------------------------------------------------------------------------

  const DIALOGUES = {
    cheeky: {
      greeting: [
        "Miss me? Of course you did.",
        "Another tab? You spoil me.",
        "I'm not clingy, you're clingy.",
        "Oh look, a new web to explore!",
        "Back again? I web-knew it.",
        "Plot twist: I was here first."
      ],
      summon: [
        "You rang? Make it quick.",
        "Ta-da! Dramatic entrance complete.",
        "Summoned like a tiny hero.",
        "I was napping on the toolbar.",
        "At your silk-spinning service!"
      ],
      interact: [
        "Boop! Did that tickle?",
        "Stop clicking, I'm ticklish!",
        "That's my good leg!",
        "Eight legs, zero personal space.",
        "I charge per click, y'know.",
        "Are we bonding? We're bonding.",
        "Click me again, I dare you."
      ],
      focusStart: [
        "Focus mode: distractions fear me.",
        "Let's spin some productivity!",
        "Time to weave some magic.",
        "No flies on us. Just focus."
      ],
      focusPause: [
        "Pausing? Fine, I'll wait. Tapping…",
        "Break time — I'll guard the web.",
        "Go stretch. I'll judge silently."
      ],
      focusComplete: [
        "Done! You absolute legend.",
        "Look at you, being productive!",
        "I'd clap but… eight legs.",
        "Nailed it. Web-five! ✋🕸️",
        "You spun that session perfectly!"
      ],
      hydrationReminder: [
        "Drink water or I'll judge you.",
        "Hydration check! Sip sip, human.",
        "Even spiders drink dew drops.",
        "Your web dries out without water.",
        "H₂-Oh yeah, time to drink!"
      ],
      hydrationComplete: [
        "Hydration goal smashed! Splashy.",
        "You're basically a waterfall now.",
        "Peak hydration achieved. Respect.",
        "Well-watered human = happy spider."
      ],
      spiderRescue: [
        "My cousin thanks you!",
        "Hero! That spider owes you one.",
        "Careful — that's a friend of mine.",
        "Spider saved! We remember this.",
        "You're an honorary arachnid now."
      ],
      rewardUnlock: [
        "Ooh, shiny! New drip unlocked!",
        "Fashion upgrade! Looking sharp.",
        "Achievement get! Frame that.",
        "New look? Very spider-chic."
      ],
      slipRecovery: [
        "Whoa, nice save! Sticky landing.",
        "Graceful? No. Saved? Yes.",
        "Slip happens. I've got 8 legs.",
        "That was… almost embarrassing."
      ],
      encouragement: [
        "You've got this. Probably.",
        "Spiders believe in you. All of us.",
        "Keep going — I'm invested now.",
        "Even my web couldn't hold you back!"
      ]
    },
    brave: {
      greeting: [
        "A new quest awaits, brave one!",
        "The web of destiny unfolds!",
        "Stand tall — your spider is here!",
        "Adventure calls! Let's answer it!",
        "Fear not — I guard this tab!"
      ],
      summon: [
        "You called? I answer! Always!",
        "Reporting for duty, commander!",
        "Your champion spider has arrived!",
        "I swing to your side!",
        "Ready for action — say the word!"
      ],
      interact: [
        "Together, we are unstoppable!",
        "Your courage inspires me!",
        "Every click forges our bond!",
        "A warrior's tap! I feel it!",
        "Side by side, always!",
        "Onward! Destiny awaits!"
      ],
      focusStart: [
        "Focus is our sharpest weapon!",
        "Into the arena of productivity!",
        "Discipline is true heroism!",
        "The battle for focus begins!"
      ],
      focusPause: [
        "Even heroes must rest. Breathe.",
        "Recharge your strength, warrior.",
        "A strategic pause — well played."
      ],
      focusComplete: [
        "Victory! The session is ours!",
        "You conquered every minute!",
        "A hero's focus — truly epic!",
        "The quest is complete! Glory!"
      ],
      hydrationReminder: [
        "A hero needs water! Drink up!",
        "Hydration fuels your strength!",
        "Water is the elixir of heroes!",
        "Replenish! The quest continues!"
      ],
      hydrationComplete: [
        "Hydration quest: COMPLETE!",
        "You've conquered your water goal!",
        "Fully fueled for battle!",
        "The river of strength flows in you!"
      ],
      spiderRescue: [
        "A true act of heroism!",
        "You saved a fellow warrior!",
        "Noble heart! Spiders salute you!",
        "A rescue worthy of the bravest!"
      ],
      rewardUnlock: [
        "New gear unlocked! Suit up!",
        "A trophy for the champion!",
        "Your bravery earned this reward!"
      ],
      slipRecovery: [
        "A stumble? Heroes recover fast!",
        "You fell — and rose stronger!",
        "The brave don't stay down!"
      ],
      encouragement: [
        "You have the heart of a hero!",
        "Courage runs in your veins!",
        "The web believes in you!"
      ]
    },
    calm: {
      greeting: [
        "Welcome back. Breathe gently.",
        "A fresh page, a fresh breath.",
        "Like dew on silk — here you are.",
        "The web greets you softly.",
        "Peace settles with each new tab."
      ],
      summon: [
        "I'm here, quiet and ready.",
        "Like a leaf landing — I arrive.",
        "Present. Peaceful. With you.",
        "Gently, I appear at your side."
      ],
      interact: [
        "A soft touch on the web.",
        "Each click, a gentle ripple.",
        "Like rain on a still pond.",
        "The web hums with warmth.",
        "A moment shared together."
      ],
      focusStart: [
        "Let stillness carry you forward.",
        "Focus like a quiet stream.",
        "One thread at a time."
      ],
      focusPause: [
        "Breathe. The web will wait.",
        "Rest is part of the rhythm."
      ],
      focusComplete: [
        "Peaceful completion. Well done.",
        "Calm mind, great work.",
        "The thread is gently finished."
      ],
      hydrationReminder: [
        "Water brings clarity. Take a sip.",
        "Like rain for the flowers — drink.",
        "A mindful sip for a peaceful mind."
      ],
      hydrationComplete: [
        "Nourished and balanced.",
        "Your well of strength is full.",
        "Gentle hydration achieved."
      ],
      spiderRescue: [
        "Kindness ripples through the web.",
        "A peaceful soul saved.",
        "Harmony is restored."
      ],
      rewardUnlock: [
        "A gentle treasure for your journey.",
        "Graceful rewards unfold softly."
      ],
      slipRecovery: [
        "Even leaves drift before landing.",
        "A quiet recovery.",
        "Balance is always restored."
      ],
      encouragement: [
        "Flow at your own gentle pace.",
        "The web supports you completely.",
        "All is well. Keep breathing."
      ]
    }
  };

  const lastUsedDialogue = new Map();

  function getDialogue(personality, category) {
    const p = DIALOGUES[personality] || DIALOGUES.cheeky;
    const lines = p[category] || DIALOGUES.cheeky[category] || ["..."];
    const key = `${personality}:${category}`;
    const lastIdx = lastUsedDialogue.get(key);

    let idx = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && idx === lastIdx) {
      idx = (idx + 1) % lines.length;
    }
    lastUsedDialogue.set(key, idx);
    return lines[idx];
  }

  // ---------------------------------------------------------------------------
  // Shadow DOM Styles & Markup
  // ---------------------------------------------------------------------------

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }

      .stage {
        --wb-char-size: 88px;
        --wb-char-height: calc(var(--wb-char-size) * 1.25);
        --wb-web-color: #e8fbff;
        --wb-accent: #ff4d5f;
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        pointer-events: none;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .stage.hidden {
        display: none !important;
      }

      /* Character sizes */
      .stage.size-tiny { --wb-char-size: 40px; }
      .stage.size-mini { --wb-char-size: 52px; }
      .stage.size-small { --wb-char-size: 64px; }
      .stage.size-medium { --wb-char-size: 88px; }
      .stage.size-large { --wb-char-size: 112px; }

      /* Web line */
      .web-line {
        position: fixed;
        left: 0;
        top: 0;
        width: 3px;
        height: 0;
        background: var(--wb-web-color);
        box-shadow: 1px 0 0 rgba(7, 11, 25, 0.4);
        transform-origin: 50% 0;
        opacity: 0.94;
        will-change: height, transform, left, top;
        image-rendering: pixelated;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .web-line.shooting {
        opacity: 1;
        filter: drop-shadow(0 0 4px #75d8ff);
      }

      /* Buddy */
      .buddy {
        position: absolute;
        width: var(--wb-char-size);
        height: var(--wb-char-height);
        left: calc(100vw - 120px);
        top: 80px;
        pointer-events: auto;
        cursor: grab;
        user-select: none;
        touch-action: none;
        will-change: transform, left, top;
        outline: none;
      }
      .buddy:active {
        cursor: grabbing;
      }
      .buddy:focus-visible {
        outline: 2px dashed #5c7cff;
        outline-offset: 4px;
        border-radius: 8px;
      }

      .hero-shell {
        position: relative;
        width: 100%;
        height: 100%;
        transform-origin: 50% 8%;
        animation: idle-sway 3.2s steps(10, end) infinite alternate;
        filter: drop-shadow(3px 4px 0 rgba(7, 11, 25, 0.28));
        transition: filter 0.12s steps(2, end);
      }
      .buddy:hover .hero-shell {
        filter: drop-shadow(0 10px 14px rgba(7, 11, 25, 0.42)) brightness(1.06);
      }

      .sprite-facing {
        width: 100%;
        height: 100%;
        overflow: hidden;
        transform: scaleX(1);
        transition: transform 0.08s steps(1, end);
      }
      .buddy.facing-left .sprite-facing {
        transform: scaleX(-1);
      }

      /* Character Sprite Sheet (8 frames: hang, anticipate, flight, recover, stand, walk, walk, punch) */
      .hero-art {
        display: block;
        width: 800%;
        max-width: none;
        height: 100%;
        object-fit: fill;
        image-rendering: auto;
        pointer-events: none;
        transform: translateX(0);
      }
      .stage.char-classic .hero-art,
      .walker.char-classic img {
        image-rendering: pixelated;
        image-rendering: crisp-edges;
      }
      .buddy.anticipating .hero-art { transform: translateX(-12.5%); }
      .buddy.in-flight .hero-art    { transform: translateX(-25%); }
      .buddy.recovering .hero-art   { transform: translateX(-37.5%); }

      /* Hero squad walking along the bottom of the page */
      .squad {
        position: fixed;
        inset: auto 0 0 0;
        height: 0;
        pointer-events: none;
        z-index: 80;
      }
      .walker {
        position: fixed;
        left: 0;
        bottom: 2px;
        width: calc(var(--wb-char-size) * 0.72);
        height: calc(var(--wb-char-size) * 0.9);
        pointer-events: none;
        filter: drop-shadow(2px 3px 0 rgba(7, 11, 25, 0.25));
        will-change: transform;
      }
      .walker .w-face {
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      .walker.left .w-face {
        transform: scaleX(-1);
      }
      .walker img {
        display: block;
        width: 800%;
        max-width: none;
        height: 100%;
        pointer-events: none;
        transform: translateX(calc(var(--frame, 4) * -12.5%));
      }
      .walker.hit .w-face {
        animation: walker-hit 0.25s ease-out;
      }
      .squad-pow {
        position: fixed;
        width: 60px;
        margin-left: -30px;
        text-align: center;
        font: 900 15px/1 Impact, "Arial Black", sans-serif;
        letter-spacing: 1px;
        color: #fff36b;
        -webkit-text-stroke: 1.5px #2a0b3a;
        text-shadow: 2px 2px 0 #2a0b3a;
        pointer-events: none;
        animation: squad-pow 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) forwards;
      }

      .buddy.anticipating .hero-shell {
        animation: anticipate 0.2s ease-in forwards;
      }
      .buddy.in-flight .hero-shell {
        animation: none;
      }

      /* Badge Slot (equipped cosmetics) */
      .badge-slot {
        position: absolute;
        top: 2px;
        right: 4px;
        font-size: 14px;
        pointer-events: none;
        z-index: 2;
      }

      /* Sparkle Effect Slot */
      .effect-slot {
        position: absolute;
        inset: -10px;
        pointer-events: none;
        display: none;
        background: radial-gradient(circle, rgba(255,255,255,0.8) 10%, transparent 60%);
        border-radius: 50%;
        animation: sparkle-burst 0.35s ease-out forwards;
      }
      .effect-slot.active {
        display: block;
      }

      /* Speech Bubble */
      .bubble {
        position: absolute;
        right: calc(100% + 12px);
        bottom: 35%;
        width: max-content;
        max-width: 220px;
        padding: 9px 13px;
        border: 2px solid #1a2035;
        border-radius: 12px 12px 2px 12px;
        color: #121727;
        background: #ffffff;
        box-shadow: 0 8px 24px rgba(10, 16, 36, 0.22);
        font: 600 12px/1.35 Inter, ui-sans-serif, system-ui, sans-serif;
        opacity: 0;
        transform: translateY(6px) scale(0.95);
        transition: opacity 0.2s cubic-bezier(0.2, 0.9, 0.3, 1), transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
        pointer-events: none;
        z-index: 10;
        word-break: break-word;
      }
      .bubble.show {
        opacity: 1;
        transform: none;
      }
      .buddy.facing-left .bubble {
        right: auto;
        left: calc(100% + 12px);
        border-radius: 12px 12px 12px 2px;
      }

      /* Focus Patrol Top Badge */
      .focus-badge {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 14px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 99px;
        color: #f7f9ff;
        background: #11162ae6;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        font: 700 11px/1.2 Inter, system-ui, sans-serif;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease, transform 0.25s ease;
        backdrop-filter: blur(8px);
        z-index: 100;
      }
      .focus-badge.active {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        pointer-events: auto;
      }
      .focus-pulse {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #5c7cff;
        box-shadow: 0 0 0 4px rgba(92, 124, 255, 0.25);
        animation: pulse 2s infinite;
      }
      .focus-close {
        background: transparent;
        border: none;
        color: #8c97b8;
        font-size: 11px;
        cursor: pointer;
        padding: 0 2px;
        margin-left: 4px;
        border-radius: 4px;
      }
      .focus-close:hover {
        color: #fff;
      }

      /* Hydration Widget */
      .hydration-widget {
        position: fixed;
        right: 16px;
        bottom: 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        width: 170px;
        padding: 10px 12px;
        border: 2px solid #141b31;
        border-radius: 12px;
        color: #edf5ff;
        background: #0f152de8;
        box-shadow: 0 10px 28px rgba(5, 9, 20, 0.35);
        pointer-events: auto;
        backdrop-filter: blur(8px);
        z-index: 100;
        transition: transform 0.2s ease, opacity 0.2s ease;
      }
      .hydration-widget.hidden {
        display: none !important;
      }
      .hydration-icon {
        font-size: 18px;
      }
      .hydration-info {
        flex: 1;
        min-width: 0;
      }
      .hydration-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font: 800 10px/1 ui-monospace, monospace;
        letter-spacing: 0.5px;
      }
      .water-count {
        color: #4dc2ff;
      }
      .water-track {
        height: 6px;
        margin-top: 5px;
        border-radius: 3px;
        background: #070c1a;
        overflow: hidden;
        border: 1px solid #1c2748;
      }
      .water-fill {
        display: block;
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #1e70eb, #44bafa);
        transition: width 0.3s cubic-bezier(0.2, 0.8, 0.4, 1);
      }
      .hydration-btns {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .water-btn {
        width: 22px;
        height: 18px;
        padding: 0;
        border: 1px solid #3c5484;
        border-radius: 4px;
        color: #fff;
        background: #172445;
        font: 900 12px/1 monospace;
        cursor: pointer;
        display: grid;
        place-items: center;
      }
      .water-btn:hover {
        background: #253866;
        border-color: #6aa3ff;
      }
      .water-btn:active {
        transform: scale(0.92);
      }

      /* Tiny Spiders */
      .tiny-spider {
        position: fixed;
        width: 20px;
        height: 18px;
        padding: 0;
        border: 0;
        background: transparent;
        pointer-events: auto;
        cursor: pointer;
        image-rendering: pixelated;
        z-index: 90;
        outline: none;
        transition: transform 0.15s ease;
      }
      .tiny-spider:focus-visible {
        outline: 2px dashed #ff4d5f;
        outline-offset: 2px;
        border-radius: 2px;
      }
      .tiny-spider span {
        position: absolute;
        left: 6px;
        top: 5px;
        width: 8px;
        height: 8px;
        background: #0b0f1d;
        box-shadow: inset 2px 2px #ef3152;
      }
      .tiny-spider::before {
        content: "";
        position: absolute;
        left: 1px;
        top: 3px;
        width: 4px;
        height: 3px;
        background: #0b0f1d;
        box-shadow: 14px 0 #0b0f1d, 0 8px #0b0f1d, 14px 8px #0b0f1d;
      }
      .tiny-spider::after {
        content: "";
        position: absolute;
        left: 3px;
        top: 1px;
        width: 3px;
        height: 3px;
        background: #0b0f1d;
        box-shadow: 10px 0 #0b0f1d, 0 12px #0b0f1d, 10px 12px #0b0f1d;
      }
      .tiny-spider.caught {
        animation: rescue-pop 0.3s cubic-bezier(0.2, 0.9, 0.3, 1) forwards !important;
        pointer-events: none;
      }

      /* Keyframe animations */
      @keyframes walker-hit {
        0%   { translate: 0 0; }
        40%  { translate: 0 -6px; }
        100% { translate: 0 0; }
      }
      @keyframes squad-pow {
        0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
        30%  { transform: scale(1.2) rotate(-6deg); opacity: 1; }
        100% { transform: scale(1) rotate(-6deg) translateY(-14px); opacity: 0; }
      }
      @keyframes idle-sway {
        from { transform: rotate(-2.5deg) translateX(-2px); }
        to   { transform: rotate(2.5deg) translateX(2px); }
      }
      @keyframes anticipate {
        from { transform: translateY(0) rotate(0); }
        to   { transform: translateY(-7px) rotate(-6deg); }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50%      { transform: scale(1.2); opacity: 0.7; }
      }
      @keyframes rescue-pop {
        0%   { transform: scale(1); opacity: 1; }
        50%  { transform: scale(1.6) rotate(20deg); filter: brightness(2); }
        100% { transform: scale(0); opacity: 0; }
      }
      @keyframes sparkle-burst {
        0%   { transform: scale(0.6); opacity: 0.9; }
        100% { transform: scale(1.5); opacity: 0; }
      }
      @keyframes spider-crawl {
        0%   { transform: translate(0, 0) rotate(0deg); }
        25%  { transform: translate(18px, 12px) rotate(45deg); }
        50%  { transform: translate(32px, -8px) rotate(15deg); }
        75%  { transform: translate(14px, 20px) rotate(-30deg); }
        100% { transform: translate(0, 0) rotate(0deg); }
      }

      /* Reduced motion preferences */
      @media (prefers-reduced-motion: reduce) {
        .hero-shell { animation: none !important; }
        .tiny-spider { animation: none !important; }
        .web-line { transition: none !important; }
      }
      .reduced-motion .hero-shell { animation: none !important; }
      .reduced-motion .walker .w-face { animation: none !important; }
      .reduced-motion .tiny-spider { animation: none !important; }
    </style>

    <div class="stage hidden">
      <div class="focus-badge" role="status">
        <span class="focus-pulse" aria-hidden="true"></span>
        <span class="focus-text">◎ Focus · 25:00</span>
        <button class="focus-close" title="Dismiss focus badge">✕</button>
      </div>

      <div class="web-line" aria-hidden="true"></div>

      <div class="squad" aria-hidden="true"></div>

      <div class="hydration-widget" aria-label="Daily water tracker">
        <span class="hydration-icon" aria-hidden="true">💧</span>
        <div class="hydration-info">
          <div class="hydration-header">
            <strong>WATER</strong>
            <span class="water-count">0/8</span>
          </div>
          <div class="water-track"><span class="water-fill"></span></div>
        </div>
        <div class="hydration-btns">
          <button class="water-btn water-add" title="Add one glass">+</button>
          <button class="water-btn water-sub" title="Remove one glass">−</button>
        </div>
      </div>

      <div class="buddy" role="button" aria-label="Webling, your tiny web hero" tabindex="0">
        <div class="bubble" aria-live="polite"></div>
        <div class="hero-shell">
          <div class="badge-slot" aria-hidden="true"></div>
          <div class="sprite-facing">
            <img class="hero-art" src="${heroAssetUrl}" alt="" />
          </div>
        </div>
        <div class="effect-slot" aria-hidden="true"></div>
      </div>
    </div>
  `;

  // ---------------------------------------------------------------------------
  // Element References
  // ---------------------------------------------------------------------------

  const stage = shadow.querySelector('.stage');
  const buddy = shadow.querySelector('.buddy');
  const heroShell = shadow.querySelector('.hero-shell');
  const webLine = shadow.querySelector('.web-line');
  const bubble = shadow.querySelector('.bubble');
  const badgeSlot = shadow.querySelector('.badge-slot');
  const effectSlot = shadow.querySelector('.effect-slot');
  const heroArt = shadow.querySelector('.hero-art');
  const squadLane = shadow.querySelector('.squad');
  const focusBadge = shadow.querySelector('.focus-badge');
  const focusText = shadow.querySelector('.focus-text');
  const focusClose = shadow.querySelector('.focus-close');
  const hydrationWidget = shadow.querySelector('.hydration-widget');
  const waterCount = shadow.querySelector('.water-count');
  const waterFill = shadow.querySelector('.water-fill');
  const waterAdd = shadow.querySelector('.water-add');
  const waterSub = shadow.querySelector('.water-sub');

  // ---------------------------------------------------------------------------
  // Local State
  // ---------------------------------------------------------------------------

  let settings = {
    enabled: true,
    personality: 'cheeky',
    characterSize: 'medium',
    characterPx: 88,
    character: 'webling',
    squadMode: true,
    squadFights: true,
    startPosition: 'top-right',
    swingToClicks: false,
    showFocusIndicator: true,
    showHydrationWidget: true,
    spidersEnabled: true,
    showSpeechBubbles: true,
    quietMode: false,
    mishapFrequency: 'normal',
    webLineColor: '#e8fbff',
    reducedMotion: false,
    videoDimming: false,
    hydrationTarget: 8,
    disabledSites: [],
    equippedCosmetics: {}
  };

  let activeFocus = {
    status: 'idle',
    endTime: 0,
    duration: 25
  };

  let hydration = 0;
  let dragging = false;
  let pointerStart = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let lastPointerX = 0;
  let anchorX = window.innerWidth - 100;
  let anchorY = 0;
  let activeAnimation = null;
  let webTrackingId = 0;
  let bubbleTimer = 0;
  let mishapTimer = 0;
  let spiderSpawnTimer = 0;
  let activeSpider = null;
  let focusInterval = 0;
  let hasBeenSummoned = false;

  const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function isMotionReduced() {
    return settings.reducedMotion || systemReducedMotion.matches;
  }

  // ---------------------------------------------------------------------------
  // Positioning Helpers
  // ---------------------------------------------------------------------------

  function getStartingCoordinates() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const bw = buddy.offsetWidth || 88;
    const bh = buddy.offsetHeight || 110;

    switch (settings.startPosition) {
      case 'top-left':
        return { x: 40, y: 80 };
      case 'bottom-left':
        return { x: 40, y: Math.max(80, h - bh - 60) };
      case 'bottom-right':
        return { x: Math.max(40, w - bw - 40), y: Math.max(80, h - bh - 60) };
      case 'top-right':
      default:
        return { x: Math.max(40, w - bw - 40), y: 80 };
    }
  }

  function move(x, y) {
    const maxX = Math.max(0, window.innerWidth - buddy.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - buddy.offsetHeight);
    buddy.style.left = `${Math.max(0, Math.min(maxX, x))}px`;
    buddy.style.top = `${Math.max(0, Math.min(maxY, y))}px`;
    syncWeb();
  }

  function syncWeb() {
    if (!settings.enabled || isSiteDisabled()) return;
    const rect = buddy.getBoundingClientRect();
    const handX = rect.left + rect.width * 0.5;
    const handY = rect.top + rect.height * 0.1;
    const dx = handX - anchorX;
    const dy = Math.max(1, handY - anchorY);
    const length = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI - 90;

    webLine.style.left = `${anchorX - 1.5}px`;
    webLine.style.top = `${anchorY}px`;
    webLine.style.height = `${length}px`;
    webLine.style.transform = `rotate(${angle}deg)`;
  }

  function trackWebDuringAnimation(durationMs) {
    cancelAnimationFrame(webTrackingId);
    const endAt = performance.now() + durationMs + 100;

    const frame = () => {
      syncWeb();
      if (performance.now() < endAt && activeAnimation) {
        webTrackingId = requestAnimationFrame(frame);
      }
    };
    webTrackingId = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Speech & Personality
  // ---------------------------------------------------------------------------

  function say(text, duration = 3000) {
    if (!settings.showSpeechBubbles) return;
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.classList.add('show');
    bubbleTimer = setTimeout(() => {
      bubble.classList.remove('show');
    }, duration);
  }

  function speakCategory(category, duration = 3000) {
    if (settings.quietMode && category !== 'interact' && category !== 'summon' && category !== 'spiderRescue') {
      return;
    }
    const line = getDialogue(settings.personality, category);
    say(line, duration);
  }

  // ---------------------------------------------------------------------------
  // Swinging & Physics
  // ---------------------------------------------------------------------------

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function swingTo(targetAnchorX, destLeft, destTop, targetAnchorY = 0) {
    if (activeAnimation) {
      try { activeAnimation.cancel(); } catch {}
      activeAnimation = null;
    }

    buddy.classList.add('anticipating');
    if (!isMotionReduced()) {
      await wait(180);
    }
    buddy.classList.remove('anticipating');

    anchorX = Math.max(20, Math.min(window.innerWidth - 20, targetAnchorX));
    anchorY = Math.max(0, Math.min(window.innerHeight * 0.5, targetAnchorY));

    webLine.classList.remove('shooting');
    void webLine.offsetWidth;
    webLine.classList.add('shooting');
    syncWeb();

    const targetLeft = Math.max(10, Math.min(window.innerWidth - buddy.offsetWidth - 10, destLeft));
    const targetTop = Math.max(40, Math.min(window.innerHeight - buddy.offsetHeight - 10, destTop));

    if (isMotionReduced()) {
      move(targetLeft, targetTop);
      syncWeb();
      return;
    }

    await wait(130);
    const start = buddy.getBoundingClientRect();
    const dx = targetLeft - start.left;
    const dy = targetTop - start.top;
    const turn = dx >= 0 ? 16 : -16;
    const lift = Math.min(-30, dy * 0.18 - 25);

    if (Math.abs(dx) > 2) {
      buddy.classList.toggle('facing-left', dx < 0);
    }

    buddy.classList.add('in-flight');

    activeAnimation = buddy.animate([
      { transform: 'translate(0,0) rotate(-4deg)', offset: 0 },
      { transform: `translate(${dx * 0.22}px, ${lift}px) rotate(${-turn * 0.7}deg)`, offset: 0.28 },
      { transform: `translate(${dx * 0.72}px, ${dy * 0.6 + 25}px) rotate(${turn}deg)`, offset: 0.72 },
      { transform: `translate(${dx}px, ${dy}px) rotate(0deg)`, offset: 1 }
    ], {
      duration: 850,
      easing: 'cubic-bezier(0.24, 0.72, 0.25, 1)',
      fill: 'forwards'
    });

    trackWebDuringAnimation(850);

    try {
      await activeAnimation.finished;
    } catch {
      return;
    }

    activeAnimation.cancel();
    activeAnimation = null;

    move(targetLeft, targetTop);
    buddy.classList.remove('in-flight');
    buddy.classList.add('recovering');

    // Sparkle effect if equipped
    if (settings.equippedCosmetics?.effect === 'effect-sparkle') {
      effectSlot.classList.remove('active');
      void effectSlot.offsetWidth;
      effectSlot.classList.add('active');
    }

    syncWeb();
    await wait(170);
    buddy.classList.remove('recovering');
  }

  function swingRandomly() {
    const rect = buddy.getBoundingClientRect();
    const goingLeft = rect.left + rect.width / 2 > window.innerWidth / 2;
    const minX = window.innerWidth * (goingLeft ? 0.15 : 0.55);
    const maxX = window.innerWidth * (goingLeft ? 0.45 : 0.85);

    const nextAnchor = minX + Math.random() * (maxX - minX);
    const nextLeft = nextAnchor - buddy.offsetWidth * 0.5;
    const nextTop = 75 + Math.random() * Math.min(130, window.innerHeight * 0.2);

    const journey = swingTo(nextAnchor, nextLeft, nextTop);
    journey.then(() => speakCategory('interact'));
    return journey;
  }

  // ---------------------------------------------------------------------------
  // Mishap (Slip and Self-Rescue)
  // ---------------------------------------------------------------------------

  function scheduleMishap() {
    clearTimeout(mishapTimer);
    if (settings.mishapFrequency === 'off' || !settings.enabled || isSiteDisabled()) return;

    let delay = 60000;
    switch (settings.mishapFrequency) {
      case 'rare':     delay = 90000 + Math.random() * 60000; break;
      case 'frequent': delay = 25000 + Math.random() * 20000; break;
      case 'normal':
      default:         delay = 45000 + Math.random() * 35000; break;
    }

    mishapTimer = setTimeout(runMishap, delay);
  }

  async function runMishap() {
    if (
      !settings.enabled ||
      isSiteDisabled() ||
      settings.mishapFrequency === 'off' ||
      activeFocus.status === 'running' ||
      dragging ||
      activeAnimation ||
      isMotionReduced()
    ) {
      scheduleMishap();
      return;
    }

    say('Uh-oh... slippery web!', 1600);
    const start = buddy.getBoundingClientRect();
    const fallDistance = Math.max(80, Math.min(220, window.innerHeight - start.bottom - 20));

    webLine.style.opacity = '0';
    buddy.classList.add('in-flight');

    activeAnimation = buddy.animate([
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: `translateY(${fallDistance}px) rotate(24deg)` }
    ], {
      duration: 580,
      easing: 'cubic-bezier(0.55, 0.02, 0.9, 0.45)',
      fill: 'forwards'
    });

    try {
      await activeAnimation.finished;
    } catch {
      scheduleMishap();
      return;
    }

    activeAnimation.cancel();
    activeAnimation = null;

    move(start.left, start.top + fallDistance);
    buddy.classList.remove('in-flight');
    webLine.style.opacity = '0.94';

    // Heroic recovery swing
    const rescueAnchor = Math.max(60, Math.min(window.innerWidth - 60, start.left + (Math.random() > 0.5 ? -140 : 150)));
    await swingTo(rescueAnchor, rescueAnchor - buddy.offsetWidth / 2, 75 + Math.random() * 60);

    speakCategory('slipRecovery', 3200);
    scheduleMishap();
  }

  // ---------------------------------------------------------------------------
  // Tiny Spider Rescue Activity
  // ---------------------------------------------------------------------------

  function scheduleSpiderSpawn() {
    clearTimeout(spiderSpawnTimer);
    if (!settings.spidersEnabled || !settings.enabled || isSiteDisabled()) return;

    // Cooldown 40-75s
    const delay = 40000 + Math.random() * 35000;
    spiderSpawnTimer = setTimeout(spawnSpider, delay);
  }

  function spawnSpider() {
    if (
      activeSpider ||
      !settings.spidersEnabled ||
      !settings.enabled ||
      isSiteDisabled() ||
      activeFocus.status === 'running'
    ) {
      scheduleSpiderSpawn();
      return;
    }

    const spider = document.createElement('button');
    spider.className = 'tiny-spider';
    spider.setAttribute('aria-label', 'Catch tiny spider');
    spider.innerHTML = '<span></span>';

    // Position at random spot away from edges
    const x = Math.max(50, Math.min(window.innerWidth - 70, Math.random() * (window.innerWidth - 120)));
    const y = Math.max(100, Math.min(window.innerHeight - 120, Math.random() * (window.innerHeight - 200)));

    spider.style.left = `${x}px`;
    spider.style.top = `${y}px`;

    if (!isMotionReduced()) {
      spider.style.animation = 'spider-crawl 14s steps(28, end) infinite alternate';
    }

    const rescue = (e) => {
      e.stopPropagation();
      rescueSpider(spider);
    };

    spider.addEventListener('click', rescue);
    spider.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        rescue(e);
      }
    });

    stage.appendChild(spider);
    activeSpider = spider;
  }

  function rescueSpider(spider) {
    if (spider.classList.contains('caught')) return;
    spider.classList.add('caught');

    chrome.runtime.sendMessage({ type: 'RECORD_RESCUE' }, (resp) => {
      const score = resp?.spiderScore || 1;
      say(`Tiny spider rescued! Score: ${score}`, 2500);
    });

    setTimeout(() => {
      spider.remove();
      if (activeSpider === spider) activeSpider = null;
      scheduleSpiderSpawn();
    }, 350);
  }

  // ---------------------------------------------------------------------------
  // Hero Squad (other heroes stroll along the bottom and sometimes scuffle)
  // ---------------------------------------------------------------------------

  const SQUAD_HEROES = ['webling', 'titan', 'stormbringer'];
  const FRAME = { stand: 4, walkA: 5, walkB: 6, punch: 7 };
  const POW_WORDS = ['POW!', 'BAM!', 'WHAM!', 'BONK!', 'SMACK!'];

  let walkers = [];
  let squadRaf = 0;
  let squadLastTs = 0;
  let squadFightTimer = 0;
  let squadFightsSoFar = 0;

  function currentCharacter() {
    return HERO_ASSETS[settings.character] ? settings.character : 'webling';
  }

  function squadActive() {
    return Boolean(settings.squadMode) && !isSiteDisabled() && activeFocus.status !== 'running';
  }

  function walkerWidth() {
    return walkers[0]?.el.offsetWidth || 60;
  }

  function laneBounds() {
    const w = walkerWidth();
    const widgetSpace = settings.showHydrationWidget ? 205 : 8;
    return { min: 8, max: Math.max(80, window.innerWidth - w - widgetSpace) };
  }

  function setWalkerFrame(walker, frame) {
    if (walker.frame === frame) return;
    walker.frame = frame;
    walker.el.style.setProperty('--frame', frame);
  }

  function placeWalker(walker) {
    walker.el.style.transform = `translateX(${Math.round(walker.x)}px)`;
    walker.el.classList.toggle('left', walker.dir < 0);
  }

  function buildSquad() {
    const main = currentCharacter();
    const names = SQUAD_HEROES.filter((name) => name !== main);
    const same = walkers.length === names.length && walkers.every((w, i) => w.name === names[i]);
    if (same) return;

    squadLane.textContent = '';
    const { min, max } = laneBounds();
    walkers = names.map((name, i) => {
      const el = document.createElement('div');
      el.className = `walker char-${name}`;
      el.innerHTML = `<div class="w-face"><img src="${HERO_ASSETS[name]}" alt="" /></div>`;
      squadLane.appendChild(el);
      const walker = {
        name,
        el,
        x: min + ((max - min) * (i + 1)) / (names.length + 1),
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: 22 + Math.random() * 16,
        mode: 'walk',
        until: performance.now() + 3000 + Math.random() * 5000,
        step: 0,
        frame: -1,
      };
      setWalkerFrame(walker, FRAME.stand);
      placeWalker(walker);
      return walker;
    });
  }

  function popAt(x, bottomOffset) {
    const pow = document.createElement('div');
    pow.className = 'squad-pow';
    pow.textContent = POW_WORDS[Math.floor(Math.random() * POW_WORDS.length)];
    pow.style.left = `${x}px`;
    pow.style.bottom = `${bottomOffset}px`;
    squadLane.appendChild(pow);
    setTimeout(() => pow.remove(), 650);
  }

  function updateWalker(walker, now, dt) {
    const { min, max } = laneBounds();

    if (walker.mode === 'fight') {
      const foe = walker.foe;
      walker.dir = foe.x > walker.x ? 1 : -1;
      // Trade blows: whoever's turn it is throws a punch, the other flinches
      const beat = Math.floor((now - walker.fightStart) / 260);
      const attacking = (beat + (walker.leads ? 0 : 1)) % 2 === 0;
      setWalkerFrame(walker, attacking ? FRAME.punch : FRAME.stand);
      if (!attacking && walker.lastBeat !== beat) {
        walker.lastBeat = beat;
        walker.el.classList.remove('hit');
        void walker.el.offsetWidth;
        walker.el.classList.add('hit');
        if (beat % 2 === 0 || beat < 2) {
          popAt((walker.x + foe.x) / 2 + walkerWidth() / 2, walker.el.offsetHeight * 0.75);
        }
      }
      if (now > walker.until) {
        walker.mode = 'walk';
        walker.dir = foe.x > walker.x ? -1 : 1;
        walker.until = now + 4000 + Math.random() * 5000;
        walker.el.classList.remove('hit');
      }
      placeWalker(walker);
      return;
    }

    if (walker.mode === 'approach') {
      const foe = walker.foe;
      walker.dir = foe.x > walker.x ? 1 : -1;
      if (Math.abs(foe.x - walker.x) < walkerWidth() * 0.62) {
        const start = now;
        for (const fighter of [walker, foe]) {
          fighter.mode = 'fight';
          fighter.fightStart = start;
          fighter.until = start + 1700 + Math.random() * 600;
          fighter.lastBeat = -1;
        }
        foe.until = walker.until;
        walker.leads = true;
        foe.leads = false;
        return;
      }
    } else if (now > walker.until) {
      if (walker.mode === 'walk') {
        walker.mode = 'rest';
        walker.until = now + 1500 + Math.random() * 3000;
      } else {
        walker.mode = 'walk';
        walker.dir = Math.random() > 0.5 ? 1 : -1;
        walker.until = now + 4000 + Math.random() * 6000;
      }
    }

    if (walker.mode === 'rest') {
      setWalkerFrame(walker, FRAME.stand);
      placeWalker(walker);
      return;
    }

    const speed = walker.mode === 'approach' ? walker.speed * 2.2 : walker.speed;
    walker.x += walker.dir * speed * dt;
    if (walker.x < min) { walker.x = min; walker.dir = 1; }
    if (walker.x > max) { walker.x = max; walker.dir = -1; }
    walker.step += dt * (speed / 9);
    setWalkerFrame(walker, Math.floor(walker.step) % 2 === 0 ? FRAME.walkA : FRAME.walkB);
    placeWalker(walker);
  }

  function squadTick(ts) {
    const dt = squadLastTs ? Math.min(0.05, (ts - squadLastTs) / 1000) : 0;
    squadLastTs = ts;
    const now = performance.now();
    for (const walker of walkers) updateWalker(walker, now, dt);
    squadRaf = requestAnimationFrame(squadTick);
  }

  function scheduleSquadFight() {
    clearTimeout(squadFightTimer);
    if (!squadActive() || !settings.squadFights || isMotionReduced()) return;
    // First scuffle soon after the squad shows up, then every 15-30s
    const delay = squadFightsSoFar === 0 ? 4000 + Math.random() * 4000 : 15000 + Math.random() * 15000;
    squadFightTimer = setTimeout(startSquadFight, delay);
  }

  function startSquadFight(force = false) {
    const idle = walkers.filter((w) => w.mode === 'walk' || w.mode === 'rest');
    if (idle.length >= 2 && squadActive() && (settings.squadFights || force)) {
      squadFightsSoFar += 1;
      const a = idle.splice(Math.floor(Math.random() * idle.length), 1)[0];
      const b = idle[Math.floor(Math.random() * idle.length)];
      a.mode = 'approach';
      b.mode = 'approach';
      a.foe = b;
      b.foe = a;
    }
    scheduleSquadFight();
  }

  function stopSquad() {
    cancelAnimationFrame(squadRaf);
    squadRaf = 0;
    squadLastTs = 0;
    clearTimeout(squadFightTimer);
    walkers = [];
    squadLane.textContent = '';
  }

  function syncSquad() {
    if (!squadActive()) {
      stopSquad();
      return;
    }
    buildSquad();
    if (isMotionReduced()) {
      cancelAnimationFrame(squadRaf);
      squadRaf = 0;
      clearTimeout(squadFightTimer);
      for (const walker of walkers) {
        walker.mode = 'rest';
        setWalkerFrame(walker, FRAME.stand);
        placeWalker(walker);
      }
      return;
    }
    if (!squadRaf) squadRaf = requestAnimationFrame(squadTick);
    if (settings.squadFights) {
      if (!squadFightTimer) scheduleSquadFight();
    } else {
      clearTimeout(squadFightTimer);
      squadFightTimer = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Focus Patrol & Timer
  // ---------------------------------------------------------------------------

  function updateFocusIndicator() {
    clearInterval(focusInterval);

    if (activeFocus.status !== 'running' || !settings.showFocusIndicator || !settings.enabled || isSiteDisabled()) {
      focusBadge.classList.remove('active');
      return;
    }

    focusBadge.classList.add('active');

    const tick = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, activeFocus.endTime - now);
      const totalSec = Math.floor(remainingMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      focusText.textContent = `◎ Focus · ${mins}:${String(secs).padStart(2, '0')}`;

      if (remainingMs <= 0) {
        clearInterval(focusInterval);
        focusBadge.classList.remove('active');
      }
    };

    tick();
    focusInterval = setInterval(tick, 1000);
  }

  focusClose.addEventListener('click', (e) => {
    e.stopPropagation();
    focusBadge.classList.remove('active');
  });

  // ---------------------------------------------------------------------------
  // Hydration System
  // ---------------------------------------------------------------------------

  function updateHydrationUI() {
    const target = settings.hydrationTarget || 8;
    waterCount.textContent = `${hydration}/${target}`;
    const pct = Math.min(100, Math.round((hydration / target) * 100));
    waterFill.style.width = `${pct}%`;
  }

  waterAdd.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'HYDRATION_ADD' }, (resp) => {
      if (resp?.success) {
        hydration = resp.hydration;
        updateHydrationUI();
        if (resp.justCompleted) {
          speakCategory('hydrationComplete', 3200);
        } else {
          say(`Sip recorded! ${hydration}/${settings.hydrationTarget || 8} glasses.`);
        }
      }
    });
  });

  waterSub.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'HYDRATION_REMOVE' }, (resp) => {
      if (resp?.success) {
        hydration = resp.hydration;
        updateHydrationUI();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Cosmetics Application
  // ---------------------------------------------------------------------------

  function applyCosmetics() {
    const equipped = settings.equippedCosmetics || {};

    // Webline color
    let webColor = settings.webLineColor || '#e8fbff';
    if (equipped.webline === 'webline-red') webColor = '#dc2626';
    else if (equipped.webline === 'webline-gold') webColor = '#f59e0b';
    else if (equipped.webline === 'webline-rainbow') webColor = 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7)';

    stage.style.setProperty('--wb-web-color', webColor);

    // Theme filters
    let themeFilter = 'drop-shadow(3px 4px 0 rgba(7, 11, 25, 0.28))';
    if (equipped.theme === 'theme-midnight') {
      themeFilter += ' hue-rotate(200deg) brightness(0.85)';
    } else if (equipped.theme === 'theme-sunset') {
      themeFilter += ' sepia(0.3) saturate(1.4) hue-rotate(-10deg)';
    }
    heroShell.style.filter = themeFilter;

    // Badges
    badgeSlot.textContent = '';
    if (equipped.badge === 'badge-star') badgeSlot.textContent = '⭐';
    else if (equipped.badge === 'badge-crown') badgeSlot.textContent = '👑';

    // Bubble styles
    if (equipped.bubble === 'bubble-pixel') {
      bubble.style.borderStyle = 'double';
      bubble.style.borderWidth = '4px';
    } else {
      bubble.style.borderStyle = 'solid';
      bubble.style.borderWidth = '2px';
    }
  }

  // ---------------------------------------------------------------------------
  // Site Visibility & Settings Application
  // ---------------------------------------------------------------------------

  function isSiteDisabled() {
    if (!settings.enabled) return true;
    const currentHost = window.location.hostname.toLowerCase();
    const disabledList = Array.isArray(settings.disabledSites) ? settings.disabledSites : [];
    return disabledList.some((site) => {
      const s = site.toLowerCase().trim();
      return currentHost === s || currentHost.endsWith('.' + s);
    });
  }

  function applySettings() {
    const hidden = isSiteDisabled();
    stage.classList.toggle('hidden', hidden);

    stage.classList.remove('size-tiny', 'size-mini', 'size-small', 'size-medium', 'size-large');
    stage.classList.add(`size-${settings.characterSize || 'medium'}`);
    if (typeof settings.characterPx === 'number') {
      stage.style.setProperty('--wb-char-size', `${Math.round(settings.characterPx)}px`);
    } else {
      stage.style.removeProperty('--wb-char-size');
    }

    const character = HERO_ASSETS[settings.character] ? settings.character : 'webling';
    for (const name of Object.keys(HERO_ASSETS)) {
      stage.classList.toggle(`char-${name}`, name === character);
    }
    if (heroArt.getAttribute('src') !== HERO_ASSETS[character]) {
      heroArt.src = HERO_ASSETS[character];
    }

    stage.classList.toggle('reduced-motion', isMotionReduced());

    hydrationWidget.classList.toggle('hidden', !settings.showHydrationWidget);

    if (settings.videoDimming && activeFocus.status === 'running') {
      document.documentElement.setAttribute('data-webling-focus', 'dim');
    } else {
      document.documentElement.removeAttribute('data-webling-focus');
    }

    applyCosmetics();
    updateHydrationUI();
    updateFocusIndicator();
    syncSquad();

    if (!hidden) {
      syncWeb();
      scheduleMishap();
      scheduleSpiderSpawn();
    } else {
      clearTimeout(mishapTimer);
      clearTimeout(spiderSpawnTimer);
      if (activeSpider) {
        activeSpider.remove();
        activeSpider = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // User Interaction & Dragging (Pointer Events)
  // ---------------------------------------------------------------------------

  buddy.addEventListener('pointerdown', (e) => {
    dragging = false;
    pointerStart = { x: e.clientX, y: e.clientY };
    lastPointerX = e.clientX;
    const rect = buddy.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    buddy.setPointerCapture(e.pointerId);
  });

  buddy.addEventListener('pointermove', (e) => {
    if (!buddy.hasPointerCapture(e.pointerId)) return;
    const dist = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    if (dist > 5) {
      dragging = true;
    }
    if (Math.abs(e.clientX - lastPointerX) > 2) {
      buddy.classList.toggle('facing-left', e.clientX < lastPointerX);
      lastPointerX = e.clientX;
    }
    move(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
  });

  buddy.addEventListener('pointerup', (e) => {
    if (buddy.hasPointerCapture(e.pointerId)) {
      buddy.releasePointerCapture(e.pointerId);
    }
    if (!dragging) {
      // Tap/click triggers random playful swing
      swingRandomly();
    } else {
      // Position buddy and set new web anchor directly above
      const rect = buddy.getBoundingClientRect();
      anchorX = rect.left + rect.width * 0.5;
      anchorY = Math.max(0, Math.min(anchorY, rect.top - 15));
      syncWeb();
    }
    dragging = false;
  });

  buddy.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      swingRandomly();
    }
  });

  // ---------------------------------------------------------------------------
  // Swing-to-Page-Clicks (Smart Filtering)
  // ---------------------------------------------------------------------------

  document.addEventListener('click', (e) => {
    if (!settings.enabled || !settings.swingToClicks || isSiteDisabled()) return;

    // Check if click target is extension UI
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host)) return;

    // Check if clicking interactive element, editable field, button, link, form, media
    const isInteractive = path.some((el) => {
      if (!el || !el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      if (['a', 'button', 'input', 'select', 'textarea', 'label', 'summary', 'details', 'video', 'audio'].includes(tag)) {
        return true;
      }
      if (el.isContentEditable) return true;
      if (el.getAttribute && (el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link')) return true;
      return false;
    });

    if (isInteractive) return;

    const targetX = e.clientX;
    const targetY = e.clientY;
    const nextLeft = targetX - buddy.offsetWidth * 0.5;
    const nextTop = Math.max(60, targetY - buddy.offsetHeight * 0.55);

    swingTo(targetX, nextLeft, nextTop, 0).then(() => {
      speakCategory('interact');
    });
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // Window Resizing & Viewport Clamping
  // ---------------------------------------------------------------------------

  let resizeDebounce = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      const rect = buddy.getBoundingClientRect();
      move(rect.left, rect.top);
      anchorX = Math.max(20, Math.min(window.innerWidth - 20, anchorX));
      anchorY = Math.max(0, Math.min(window.innerHeight * 0.5, anchorY));
      syncWeb();
    }, 80);
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // Summon Action
  // ---------------------------------------------------------------------------

  function summon() {
    hasBeenSummoned = true;
    if (!settings.enabled) {
      settings.enabled = true;
    }
    applySettings();

    const rect = buddy.getBoundingClientRect();
    if (rect.top < 0 || rect.left < 0 || rect.left > window.innerWidth || rect.top > window.innerHeight) {
      const start = getStartingCoordinates();
      move(start.x, start.y);
    }

    swingRandomly().then(() => {
      speakCategory('summon', 3500);
    });
  }

  // ---------------------------------------------------------------------------
  // Page Stats Intelligence
  // ---------------------------------------------------------------------------

  function calculatePageIntel() {
    // Extract text safely without scripts, styles, or extension UI
    const clone = document.body ? document.body.cloneNode(true) : null;
    if (!clone) {
      return { words: 0, minutes: 0, links: 0, headings: 0, images: 0 };
    }

    // Strip script, style, noscript, template, extension root
    const removeSelectors = ['script', 'style', 'noscript', 'template', '#webling-extension-root'];
    removeSelectors.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    });

    const text = (clone.innerText || clone.textContent || '').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const minutes = words === 0 ? 0 : Math.ceil(words / 220);
    const links = document.links ? document.links.length : 0;
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    const images = document.images ? document.images.length : 0;

    return { words, minutes, links, headings, images };
  }

  // ---------------------------------------------------------------------------
  // Message Listener (from Background & Popup)
  // ---------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'WEBLING_SUMMON': {
        summon();
        sendResponse({ success: true });
        break;
      }

      case 'WEBLING_SQUAD_FIGHT': {
        settings.squadMode = true;
        syncSquad();
        // Give freshly spawned walkers a moment to appear before they charge
        setTimeout(() => startSquadFight(true), walkers.length ? 150 : 400);
        sendResponse({ success: true, squad: walkers.length });
        break;
      }

      case 'SETTING_CHANGED': {
        settings[message.key] = message.value;
        applySettings();
        if (message.key === 'personality') {
          say('New vibe unlocked!');
        } else if (message.key === 'character') {
          say('Suit up!');
        }
        sendResponse({ success: true });
        break;
      }

      case 'SETTINGS_BULK_UPDATE': {
        settings = { ...settings, ...(message.settings || {}) };
        applySettings();
        sendResponse({ success: true });
        break;
      }

      case 'VISIBILITY_UPDATE': {
        if (Array.isArray(message.disabledSites)) {
          settings.disabledSites = message.disabledSites;
        }
        applySettings();
        sendResponse({ success: true });
        break;
      }

      case 'FOCUS_STATE_CHANGED': {
        activeFocus.status = message.focusStatus;
        syncSquad();
        if (message.focusEndTime) activeFocus.endTime = message.focusEndTime;
        if (message.focusDuration) activeFocus.duration = message.focusDuration;
        applySettings();
        sendResponse({ success: true });
        break;
      }

      case 'FOCUS_COMPLETED': {
        activeFocus.status = 'idle';
        syncSquad();
        applySettings();
        speakCategory('focusComplete', 4000);
        swingRandomly();
        sendResponse({ success: true });
        break;
      }

      case 'HYDRATION_UPDATE': {
        if (typeof message.hydration === 'number') {
          hydration = message.hydration;
          updateHydrationUI();
        }
        sendResponse({ success: true });
        break;
      }

      case 'HYDRATION_REMINDER': {
        speakCategory('hydrationReminder', 4000);
        sendResponse({ success: true });
        break;
      }

      case 'ACHIEVEMENT_UNLOCKED': {
        say(`Achievement! 🏆 ${message.name}`, 3800);
        sendResponse({ success: true });
        break;
      }

      case 'COSMETIC_UNLOCKED': {
        say(`Reward unlocked! 🎁 ${message.name}`, 3800);
        sendResponse({ success: true });
        break;
      }

      case 'COSMETIC_EQUIPPED': {
        if (!settings.equippedCosmetics) settings.equippedCosmetics = {};
        settings.equippedCosmetics[message.category] = message.cosmeticId;
        applyCosmetics();
        say('New style equipped!');
        sendResponse({ success: true });
        break;
      }

      case 'RESET_ALL_COMPLETE': {
        window.location.reload();
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false });
    }
    return true;
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (resp) => {
    if (resp?.success && resp.data) {
      const data = resp.data;
      settings = {
        enabled: data.enabled,
        personality: data.personality,
        characterSize: data.characterSize,
        characterPx: data.characterPx,
        character: data.character,
        squadMode: data.squadMode,
        squadFights: data.squadFights,
        startPosition: data.startPosition,
        swingToClicks: data.swingToClicks,
        showFocusIndicator: data.showFocusIndicator,
        showHydrationWidget: data.showHydrationWidget,
        spidersEnabled: data.spidersEnabled,
        showSpeechBubbles: data.showSpeechBubbles,
        quietMode: data.quietMode,
        mishapFrequency: data.mishapFrequency,
        webLineColor: data.webLineColor,
        reducedMotion: data.reducedMotion,
        videoDimming: data.videoDimming,
        hydrationTarget: data.hydrationTarget,
        disabledSites: data.disabledSites || [],
        equippedCosmetics: data.equippedCosmetics || {}
      };

      activeFocus = {
        status: data.focusStatus || 'idle',
        endTime: data.focusEndTime || 0,
        duration: data.focusDuration || 25
      };

      hydration = data.hydration || 0;
    }

    // Initial position
    const startPos = getStartingCoordinates();
    move(startPos.x, startPos.y);
    anchorX = startPos.x + (buddy.offsetWidth || 88) * 0.5;
    anchorY = 0;

    applySettings();

    // Welcome greeting
    if (!isSiteDisabled() && !hasBeenSummoned && !settings.quietMode) {
      setTimeout(() => {
        speakCategory('greeting', 3000);
      }, 600);
    }

    // Report page patrol to background
    if (/^(https?|file):\/\//.test(window.location.href)) {
      chrome.runtime.sendMessage({
        type: 'RECORD_PATROL',
        url: window.location.href
      }).catch(() => {});
    }
  });

})();
