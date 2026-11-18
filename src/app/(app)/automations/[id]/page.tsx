import { Suspense } from "react";
import View from "./View";

// "_" is the single pre-rendered page the static (GitHub Pages) build serves for every id via ?id=.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
