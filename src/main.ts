import Phaser from 'phaser';
import { getLanguage, onLanguageChange, t } from './i18n';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import './style.css';

function syncDocument(): void {
  document.title = t('game.title');
  document.documentElement.lang = getLanguage();
}
syncDocument();
onLanguageChange(syncDocument);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#17699f',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  disableContextMenu: true,
  render: { antialias: true },
  scene: [BootScene, GameScene],
});

// Handy for debugging in the browser console during development only.
if (import.meta.env.DEV) Object.assign(window, { game });
