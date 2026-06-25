declare module "adm-zip" {
  export default class AdmZip {
    constructor(buffer?: Buffer | string);
    addFile(entryName: string, data: Buffer): void;
    getEntries(): Array<{ isDirectory: boolean; entryName: string; getData(): Buffer }>;
    toBuffer(): Buffer;
  }
}
