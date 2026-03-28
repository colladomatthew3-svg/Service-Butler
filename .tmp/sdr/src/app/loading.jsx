"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppLoading;
const skeleton_1 = require("@/components/ui/skeleton");
function AppLoading() {
    return (<div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6">
      <skeleton_1.Skeleton className="h-12 w-64"/>
      <skeleton_1.Skeleton className="h-40 w-full"/>
      <div className="grid gap-4 md:grid-cols-2">
        <skeleton_1.Skeleton className="h-52 w-full"/>
        <skeleton_1.Skeleton className="h-52 w-full"/>
      </div>
      <skeleton_1.Skeleton className="h-64 w-full"/>
    </div>);
}
