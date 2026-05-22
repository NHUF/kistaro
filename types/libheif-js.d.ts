declare module "libheif-js" {
  type HeifDisplayTarget = {
    data: Uint8ClampedArray;
    height: number;
    width: number;
  };

  type HeifDisplayResult = {
    data: Uint8ClampedArray;
    height: number;
    width: number;
  };

  type HeifImage = {
    display: (
      target: HeifDisplayTarget,
      callback: (result: HeifDisplayResult | null) => void,
    ) => void;
    free: () => void;
    get_height: () => number;
    get_width: () => number;
  };

  type HeifDecoder = {
    decode: (buffer: ArrayBuffer | Buffer | Uint8Array) => HeifImage[];
    decoder?: {
      delete?: () => void;
    };
  };

  const libheif: {
    HeifDecoder: new () => HeifDecoder;
    ready?: Promise<void>;
  };

  export = libheif;
}
