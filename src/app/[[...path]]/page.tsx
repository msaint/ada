import { Suspense } from "react";
import Ada from "@/components/ada";
export default function Page() {
  return (
    <Suspense fallback={<div className="boot">Ada is getting ready…</div>}>
      <Ada />
    </Suspense>
  );
}
