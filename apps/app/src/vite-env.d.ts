/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module '@content-pack-ru' {
  import type { ContentPack } from '@life-os/domain';
  const pack: ContentPack;
  export default pack;
}
