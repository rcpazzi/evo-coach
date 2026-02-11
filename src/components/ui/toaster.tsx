"use client";

import * as Toast from "@radix-ui/react-toast";

export function Toaster() {
  return (
    <Toast.Provider swipeDirection="right">
      <Toast.Viewport className="fixed top-4 right-4 z-50 flex max-h-screen w-full max-w-[420px] flex-col gap-2 p-4 outline-none" />
    </Toast.Provider>
  );
}
