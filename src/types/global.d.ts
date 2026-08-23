/**
 * 全局类型声明
 */

// mammoth 浏览器版本未自带类型声明，这里给出最小可用声明
declare module "mammoth/mammoth.browser" {
  export interface ConvertResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export interface ConvertOptions {
    styleMap?: string[];
  }
  export interface ConvertInput {
    arrayBuffer: ArrayBuffer;
  }
  export function convertToHtml(
    input: ConvertInput,
    options?: ConvertOptions
  ): Promise<ConvertResult>;
  const _default: {
    convertToHtml: typeof convertToHtml;
  };
  export default _default;
}
