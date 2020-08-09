import * as path from 'path';
import * as fs from 'fs';
import * as chai from 'chai';
import {ReadMe} from './readme';
import * as chaiJestSnapshot from 'chai-jest-snapshot';
import * as sinon from 'sinon';
chai.use(chaiJestSnapshot);
const {expect} = chai;

describe('ReadMe', () => {
  context('.update()', () => {
    const dir = path.join(__dirname, '../examples');
    const all = fs.readdirSync(dir);
    const examples = all.filter(e => e.match(/^error|^valid/));
    examples.forEach(example => {
      const full = path.join(dir, example);

      const prune = () => {
        const dir = fs.readdirSync(full);
        const removeReadme = dir.includes('.gitignore');
        try {
          if (removeReadme) fs.unlinkSync(path.join(full, 'README.md'));
        } catch {
          // noop
        }
      };

      beforeEach(prune);
      afterEach(prune);

      it(`should use example "${example}"`, async () => {
        let error = undefined;
        try {
          const process = {cwd: () => full};
          await ReadMe.update(process as NodeJS.Process);
        } catch (e) {
          error = e;
        }
        if (example.match(/^error/)) {
          expect(error).to.not.equal(undefined);
        }
        if (example.match(/^valid/)) {
          expect(
            fs.readFileSync(path.join(full, 'README.md'), 'utf-8')
          ).to.matchSnapshot(
            path.join(__dirname, 'snapshots', `${example}.js`),
            'use-example'
          );
          expect(error).to.equal(undefined);
        }
      });
    });
  });
  context('.cli()', () => {
    const dir = path.join(__dirname, '../examples');
    const all = fs.readdirSync(dir);
    const examples = all.filter(e => e.match(/^error|^valid/));
    examples.forEach(example => {
      const full = path.join(dir, example);

      const process = {
        cwd: () => full,
        stdout: {
          write: sinon.stub(),
        },
        stderr: {
          write: sinon.stub(),
        },
        exit: sinon.stub(),
      };

      const prune = () => {
        const dir = fs.readdirSync(full);
        const removeReadme = dir.includes('.gitignore');
        try {
          if (removeReadme) fs.unlinkSync(path.join(full, 'README.md'));
        } catch {
          // noop
        }
      };

      beforeEach(prune);
      afterEach(prune);

      it(`should use example "${example}"`, async () => {
        try {
          await ReadMe.cli((process as unknown) as NodeJS.Process);
        } catch (e) {
          // noop
        }

        if (example.match(/^error/)) {
          expect(process.exit.args).to.deep.equal([[1]]);
        }
        if (example.match(/^valid/)) {
          expect(
            fs.readFileSync(path.join(full, 'README.md'), 'utf-8')
          ).to.matchSnapshot(
            path.join(__dirname, 'snapshots', `${example}.js`),
            'use-example'
          );
          expect(process.exit.args).to.deep.equal([[0]]);
        }
      });
    });
  });
});
