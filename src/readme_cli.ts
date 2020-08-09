#!/usr/bin/env node
import {ReadMe} from './readme';

(async () => {
  await ReadMe.cli(process);
})();
