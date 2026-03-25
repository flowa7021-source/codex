import './setup-dom.js';
import { register } from 'node:module';
register(new URL('./tesseract-mock-loader.js', import.meta.url).href);
