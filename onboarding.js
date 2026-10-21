/**
 * Webling Onboarding Tour
 */

import { saveSettings } from './modules/storage.js';

let currentStep = 1;
const totalSteps = 5;

const steps = document.querySelectorAll('.step');
const dots = document.querySelectorAll('.dot');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const skipBtn = document.getElementById('skipBtn');

function showStep(stepNum) {
  currentStep = Math.max(1, Math.min(totalSteps, stepNum));

  steps.forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 === currentStep);
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx + 1 === currentStep);
    dot.setAttribute('aria-selected', idx + 1 === currentStep ? 'true' : 'false');
  });

  prevBtn.disabled = currentStep === 1;

  if (currentStep === totalSteps) {
    nextBtn.textContent = 'Get Started';
  } else {
    nextBtn.textContent = 'Next';
  }
}

async function finishOnboarding() {
  await saveSettings({ onboardingComplete: true });
  window.close();
}

prevBtn.addEventListener('click', () => {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
});

nextBtn.addEventListener('click', async () => {
  if (currentStep < totalSteps) {
    showStep(currentStep + 1);
  } else {
    await finishOnboarding();
  }
});

skipBtn.addEventListener('click', async () => {
  await finishOnboarding();
});

// Dot click navigation
dots.forEach((dot, idx) => {
  dot.addEventListener('click', () => {
    showStep(idx + 1);
  });
});

// Keyboard navigation
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' && currentStep < totalSteps) {
    showStep(currentStep + 1);
  } else if (e.key === 'ArrowLeft' && currentStep > 1) {
    showStep(currentStep - 1);
  } else if (e.key === 'Escape') {
    finishOnboarding();
  }
});

showStep(1);
