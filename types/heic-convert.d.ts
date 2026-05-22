declare module "heic-convert" {
  type ConvertResult = ArrayBuffer | Buffer | Uint8Array;

  type ConvertOptions = {
    buffer: ArrayBuffer | Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  type DeferredImage = {
    convert: () => Promise<ConvertResult>;
  };

  function convert(options: ConvertOptions): Promise<ConvertResult>;

  namespace convert {
    function all(options: ConvertOptions): Promise<DeferredImage[]>;
  }

  export = convert;
}
