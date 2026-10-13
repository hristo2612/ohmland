// Web Worker entry. Spawned by createSimClient() as a module worker.

import { attachSimHost } from "./host";
import type { PortLike } from "./protocol";

attachSimHost(self as unknown as PortLike);
