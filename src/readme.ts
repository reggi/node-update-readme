import * as fs from 'fs';
import * as path from 'path';

export interface Info {
  description?: string;
  npmName?: string;
  repoName?: string;
  githubUser?: string;
  usage: (command: string) => string | undefined;
  fileContent?: string;
  fileName?: string;
  filePath?: string;
  heading?: string;
  npxExecutable?: string;
  globalExecutable?: string;
  info: Info;
}

interface PackageJSON {
  name?: string;
  usage?: string;
  description?: string;
  bin?: {[key: string]: string} | string;
  repository?: {
    type?: string;
    url?: string;
  };
}

export class Pkg {
  constructor(public pkg: PackageJSON) {
    this.pkg = pkg;
  }
  static async fileExists(fileName: string) {
    try {
      const stat = await fs.promises.lstat(fileName);
      return stat.isFile();
    } catch (e) {
      return false;
    }
  }
  static async load(process: NodeJS.Process) {
    const pkgLocation = path.join(process.cwd(), 'package.json');
    const found = await Pkg.fileExists(pkgLocation);
    if (!found) {
      throw new Error('no package.json found in the root of this directory');
    }
    const pkgContent = await fs.promises.readFile(pkgLocation, 'utf-8');
    try {
      const pkg = JSON.parse(pkgContent);
      return new Pkg(pkg);
    } catch (e) {
      throw new Error('there was an issue parsing the package.json file');
    }
  }
  parseRepo() {
    const url = this.pkg.repository?.url || '';
    const result = url.match('https?://github.com/(.+)/(.+).git') || [];
    const [repository, githubUser, repoName] = result;
    return {githubUser, repoName, repository};
  }
  get npmName(): string | undefined {
    return this.pkg.name;
  }
  get repoName(): string | undefined {
    return this.parseRepo().repoName;
  }
  get githubUser(): string | undefined {
    return this.parseRepo().githubUser;
  }
  get description(): string | undefined {
    return this.pkg.description;
  }
  get heading() {
    return this.repoName || this.npmName;
  }
  get isScoped() {
    return this.pkg.name && this.pkg.name.split('/').length === 2;
  }
  get npxExecutable() {
    if (typeof this.pkg.bin === 'undefined') return undefined;
    if (typeof this.pkg.bin === 'string') {
      if (this.isScoped) return `-p ${this.pkg.name}`;
      return this.pkg.name;
    }
    const primary = Object.keys(this.pkg.bin)[0];
    if (this.isScoped) return `-p ${this.pkg.name} ${primary}`;
    if (this.pkg.name === primary) return this.pkg.name;
    return `${this.pkg.name} ${primary}`;
  }
  get globalExecutable() {
    if (typeof this.pkg.bin === 'undefined') return undefined;
    if (typeof this.pkg.bin === 'string' && this.pkg.name) {
      const split = this.pkg.name.split('/');
      if (split.length === 2) return split[1];
      return split[0];
    }
    const primary = Object.keys(this.pkg.bin)[0];
    return primary;
  }
  get usage() {
    return (command: string) => {
      const usage = this.pkg.usage;
      if (command && usage) return usage.replace('CMD', command);
      return command;
    };
  }
  static async info(process: NodeJS.Process) {
    const pkg = await Pkg.load(process);
    const i: Omit<Info, 'info'> = {
      npmName: pkg.npmName,
      repoName: pkg.repoName,
      githubUser: pkg.githubUser,
      usage: pkg.usage.bind(pkg),
      description: pkg.description,
      heading: pkg.heading,
      npxExecutable: pkg.npxExecutable,
      globalExecutable: pkg.globalExecutable,
    };
    return i;
  }
}

export class Template {
  static info<T extends Omit<Info, 'info'>>(info: T): Info {
    const x: Info = (info as unknown) as Info;
    x.info = (info as unknown) as Info;
    return (x as unknown) as Info;
  }
  static async readFile(filePath: string) {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (e) {
      return '';
    }
  }
  static async load(fileName: string, process: NodeJS.Process) {
    const filePath = path.join(process.cwd(), fileName);
    const fileContent = await Template.readFile(filePath);
    const pkg = await Pkg.info(process);
    const info = Template.info({...pkg, fileName, filePath, fileContent});
    const update = (content: string) => {
      return Template.update(filePath, content);
    };
    return {info, update};
  }
  static async update(filePath: string, content: string) {
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }
}

export class ReadMe {
  static badges({
    repoName,
    npmName,
    githubUser,
  }: Info): {[key: string]: {link: string; image: string}} {
    const badges: {[key: string]: {link: string; image: string}} = {};
    if (githubUser && repoName) {
      badges['semantic release'] = {
        image: `https://github.com/${githubUser}/${repoName}/workflows/semantic%20release/badge.svg`,
        link: `https://github.com/${githubUser}/${repoName}/actions?query=workflow%3A%22semantic+release%22`,
      };
      badges['coverage'] = {
        image: `https://github.com/${githubUser}/${repoName}/workflows/coverage/badge.svg`,
        link: `https://${githubUser}.github.io/${repoName}/`,
      };
    }
    if (npmName) {
      badges['npm'] = {
        image: `https://badge.fury.io/js/${npmName}.svg`,
        link: `https://www.npmjs.com/package/${npmName}`,
      };
    }
    return badges;
  }
  static badgeMarkdown(info: Info) {
    const badges = ReadMe.badges(info);
    return Object.keys(badges).map(alt => {
      const badge = badges[alt];
      return `[![${alt}](${badge.image})](${badge.link})`;
    });
  }
  static npmInstall({npmName, globalExecutable, usage}: Info) {
    return npmName
      ? [
          '## Install',
          '',
          '```',
          `npm install ${npmName}${globalExecutable ? ' -g' : ''}`,
          ...(globalExecutable ? [`${usage(globalExecutable)}`] : []),
          '```',
        ]
      : [];
  }
  static npxRun({npxExecutable, usage}: Info) {
    return npxExecutable
      ? [
          '## Use directly via `npx`',
          '',
          '```',
          `npx ${usage(npxExecutable)}`,
          '```',
        ]
      : [];
  }
  static transform({heading, fileContent, info, description}: Info) {
    const marker =
      '<!-- anything below this line will be safe from template removal -->';
    const keep = (fileContent && fileContent.split(marker)[1]) || '';
    const badge = ReadMe.badgeMarkdown(info);
    const npm = ReadMe.npmInstall(info);
    const npx = ReadMe.npxRun(info);
    const template = [
      `# ${heading || 'untitled'}`,
      ...(badge.length ? [badge.join(' ')] : []),
      ...(description ? [description] : []),
      ...(npm.length ? [npm.join('\n')] : []),
      ...(npx.length ? [npx.join('\n')] : []),
      marker,
    ];
    return template.join('\n\n') + keep;
  }
  static async update(process: NodeJS.Process) {
    const {info, update} = await Template.load('README.md', process);
    const content = ReadMe.transform(info);
    return update(content);
  }
  static async cli(process: NodeJS.Process) {
    try {
      await ReadMe.update(process);
      process.exit(0);
    } catch (e) {
      process.stderr.write(e.message + '\n');
      process.exit(1);
    }
  }
}
