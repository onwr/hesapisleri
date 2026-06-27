import Module from "node:module";

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only" || request === "next/cache") {
    return {
      revalidateTag: () => {},
      revalidatePath: () => {},
      unstable_cache: (fn) => fn,
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};
