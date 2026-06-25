declare module "libxmljs2" {
  import type { Document } from "libxmljs2";

  export type ValidationError = {
    message?: string;
    line?: number;
  };

  export interface Document {
    validate(schema: Document): boolean;
    validationErrors: ValidationError[];
  }

  export function parseXml(
    xml: string | Buffer,
    options?: { baseUrl?: string }
  ): Document;

  const libxmljs: {
    parseXml(xml: string | Buffer, options?: { baseUrl?: string }): Document;
  };

  export default libxmljs;
}
