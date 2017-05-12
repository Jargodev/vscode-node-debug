/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as Path from 'path';
import * as FS from 'fs';
import * as CP from 'child_process';
const glob = require('glob');
const minimatch = require('minimatch');

/**
  * The input paths must use the path syntax of the underlying operating system.
 */
export function makePathAbsolute(absPath: string, relPath: string): string {
	return Path.resolve(Path.dirname(absPath), relPath);
}

/**
 * Return the relative path between 'path' and 'target'.
 * The input paths must use the path syntax of the underlying operating system.
 */
export function makeRelative(target: string, path: string): string {
	const t = target.split(Path.sep);
	const p = path.split(Path.sep);

	let i = 0;
	for (; i < Math.min(t.length, p.length) && t[i] === p[i]; i++) {
	}

	let result = '';
	for (; i < p.length; i++) {
		result = Path.join(result, p[i]);
	}
	return result;
}

/**
 * Returns a path with a lower case drive letter.
 */
export function normalizeDriveLetter(path: string): string {
	const regex = /^([A-Z])(\:[\\\/].*)$/;
	if (regex.test(path)) {
		path = path.replace(regex, (s, s1, s2) => s1.toLowerCase() + s2);
	}
	return path;
}

/**
 * Change back slashes to forward slashes;
 * on Windows and macOS convert to lower case.
 */
export function pathNormalize(path: string) : string {
	path = path.replace(/\\/g, '/');
	if (process.platform === 'win32' || process.platform === 'darwin') {
		path = path.toLowerCase();
	}
	return path;
}

/**
 * On Windows change forward slashes to back slashes
 */
export function pathToNative(path: string): string {
	if (process.platform === 'win32') {
		path = path.replace(/\//g, '\\');
	}
	return path;
}

export function pathCompare(path1: string, path2: string): boolean {
	return normalizeDriveLetter(path1) === normalizeDriveLetter(path2);
}

/**
 * Given an absolute, normalized, and existing file path 'realPath' returns the exact path that the file has on disk.
 * On a case insensitive file system, the returned path might differ from the original path by character casing.
 * On a case sensitive file system, the returned path will always be identical to the original path.
 * In case of errors, null is returned. But you cannot use this function to verify that a path exists.
 * realPath does not handle '..' or '.' path segments and it does not take the locale into account.
 * Since a drive letter of a Windows path cannot be looked up, realPath normalizes the drive letter to lower case.
 */
export function realPath(path: string): string | null {

	let dir = Path.dirname(path);
	if (path === dir) {	// end recursion
		// is this an upper case drive letter?
		if (/^[A-Z]\:\\$/.test(path)) {
			path = path.toLowerCase();
		}
		return path;
	}
	let name = Path.basename(path).toLowerCase();
	try {
		let entries = FS.readdirSync(dir);
		let found = entries.filter(e => e.toLowerCase() === name);	// use a case insensitive search
		if (found.length === 1) {
			// on a case sensitive filesystem we cannot determine here, whether the file exists or not, hence we need the 'file exists' precondition
			let prefix = realPath(dir);   // recurse
			if (prefix) {
				return Path.join(prefix, found[0]);
			}
		} else if (found.length > 1) {
			// must be a case sensitive $filesystem
			const ix = found.indexOf(name);
			if (ix >= 0) {	// case sensitive
				let prefix = realPath(dir);   // recurse
				if (prefix) {
					return Path.join(prefix, found[ix]);
				}
			}
		}
	}
	catch (error) {
		// silently ignore error
	}
	return null;
}

/**
 * Make sure that all directories of the given path exist (like mkdir -p).
 */
export function mkdirs(path: string) {
	if (!FS.existsSync(path)) {
		mkdirs(Path.dirname(path));
		FS.mkdirSync(path);
	}
}

/*
 * Is the given runtime executable on the PATH.
 */
export function isOnPath(program: string): boolean {

	if (process.platform === 'win32') {
		return true;
		/*
		const WHERE = 'C:\\Windows\\System32\\where.exe';
		try {
			if (FS.existsSync(WHERE)) {
				CP.execSync(`${WHERE} ${program}`);
			} else {
				// do not report error if 'where' doesn't exist
			}
			return true;
		}
		catch (Exception) {
			// ignore
		}
		*/
	} else {
		const WHICH = '/usr/bin/which';
		try {
			if (FS.existsSync(WHICH)) {
				CP.execSync(`${WHICH} '${program}'`);
			} else {
				// do not report error if 'which' doesn't exist
			}
			return true;
		}
		catch (Exception) {
		}
	}
	return false;
}

//---- the following functions work with Windows and Unix-style paths independent from the underlying OS.

/**
 * Returns true if the Windows or Unix-style path is absolute.
 */
export function isAbsolutePath(path: string | null): boolean {
	if (path) {
		if (path.charAt(0) === '/') {
			return true;
		}
		if (/^[a-zA-Z]\:[\\\/]/.test(path)) {
			return true;
		}
	}
	return false;
}

/**
 * Convert the given Windows or Unix-style path into a normalized path that only uses forward slashes and has all superflous '..' sequences removed.
 * If the path starts with a Windows-style drive letter, a '/' is prepended.
 */
export function normalize(path: string) : string {

	path = path.replace(/\\/g, '/');
	if (/^[a-zA-Z]\:\//.test(path)) {
		path = '/' + path;
	}
	path = Path.normalize(path);	// use node's normalize to remove '<dir>/..' etc.
	path = path.replace(/\\/g, '/');
	return path;
}

/**
 * Convert the given normalized path into a Windows-style path.
 */
export function toWindows(path: string) : string {
	if (/^\/[a-zA-Z]\:\//.test(path)) {
		path = path.substr(1);
	}
	path = path.replace(/\//g, '\\');
	return path;
}

/**
 * Append the given relative path to the absolute path and normalize the result.
 */
export function join(absPath: string, relPath: string) : string {
	absPath = normalize(absPath);
	relPath = normalize(relPath);
	if (absPath.charAt(absPath.length-1) === '/') {
		absPath = absPath + relPath;
	} else {
		absPath = absPath + '/' + relPath;
	}
	absPath = Path.normalize(absPath);
	absPath = absPath.replace(/\\/g, '/');
	return absPath;
}

/**
 * Return the relative path between 'from' and 'to'.
 */
export function makeRelative2(from: string, to: string): string {

	from = normalize(from);
	to = normalize(to);

	const froms = from.substr(1).split('/');
	const tos = to.substr(1).split('/');

	while (froms.length > 0 && tos.length > 0 && froms[0] === tos[0]) {
		froms.shift();
		tos.shift();
	}

	let l = froms.length - tos.length;
	if (l === 0) {
		l = tos.length - 1;
	}

	while (l > 0) {
		tos.unshift('..');
		l--;
	}
	return tos.join('/');
}

//---- globbing support -------------------------------------------------

interface IGlobTask {
	pattern: string;
	opts: any;
}

export function multiGlob(patterns: string[], opts?): Promise<string[]> {

	const globTasks = new Array<IGlobTask>();

	opts = extendObject({
		cache: Object.create(null),
		statCache: Object.create(null),
		realpathCache: Object.create(null),
		symlinks: Object.create(null),
		ignore: []
	}, opts);

	const isExclude = pattern => pattern[0] === '!';

	try {

		patterns.forEach( (pattern, i) => {

			if (isExclude(pattern)) {
				return;
			}

			const ignore = patterns.slice(i).filter(isExclude).map(pattern => pattern.slice(1));

			globTasks.push({
				pattern: pattern,
				opts: extendObject(extendObject({}, opts), {
					ignore: opts.ignore.concat(ignore)
				})
			});
		});

	} catch (err) {
		return Promise.reject(err);
	}

	return Promise.all(globTasks.map(task => {

		return new Promise<string[]>((c, e) => {
			glob(task.pattern, task.opts, (err, files: string[]) => {
				if (err) {
					e(err);
				} else {
					c(files);
				}
			});
		});

	})).then(results =>  {

		const set = new Set<string>();
		for (let paths of results) {
			for (let p of paths) {
				set.add(p);
			}
		}
		let array = new Array<string>();
		set.forEach(v => array.push(Path.posix.normalize(v)));
		return array;
	});
}

export function multiGlobMatches(patterns: string[], path: string): boolean {

	let matched = false;
	for (const p of patterns) {
		const isExclude = p[0] === '!';
		if (matched !== isExclude) {
			break;
		}
		matched = minimatch(path, p);
	}
	return matched;
}

//---- misc

/**
 * Copy attributes from fromObject to toObject.
 */
export function extendObject<T> (toObject: T, fromObject: T): T {

	for (let key in fromObject) {
		if (fromObject.hasOwnProperty(key)) {
			toObject[key] = fromObject[key];
		}
	}
	return toObject;
}

export function stripBOM(s: string) : string{
	if (s && s[0] === '\uFEFF') {
		s = s.substr(1);
	}
	return s;
}
