// ==UserScript==
// @name         Perks Reminder — Amex Benefit Reader
// @namespace    https://perks-reminder.com/
// @version      1.0.0
// @description  Manually reads normalized benefit progress from your signed-in American Express session. Nothing scans automatically.
// @match        https://global.americanexpress.com/*
// @include      https://www.perks-reminder.com/integrations/amex-sync?transfer=*
// @run-at       document-idle
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        unsafeWindow
// @license      MIT
// @icon         https://www.perks-reminder.com/favicon.png
// @homepageURL  https://www.perks-reminder.com/
// @supportURL   https://github.com/lifan-builds/perks-reminder/issues
// ==/UserScript==
"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/lib/amex-benefit-reader/handoff-target.ts
  function resolveAmexSyncHandoffTarget(name) {
    if (name === "production") return PRODUCTION_AMEX_SYNC_HANDOFF_TARGET;
    if (name === "local") return LOCAL_AMEX_SYNC_HANDOFF_TARGET;
    throw new Error("Unsupported Amex sync handoff target.");
  }
  var AMEX_SYNC_HANDOFF_PATH, PRODUCTION_AMEX_SYNC_HANDOFF_TARGET, LOCAL_AMEX_SYNC_HANDOFF_TARGET;
  var init_handoff_target = __esm({
    "src/lib/amex-benefit-reader/handoff-target.ts"() {
      "use strict";
      AMEX_SYNC_HANDOFF_PATH = "/integrations/amex-sync";
      PRODUCTION_AMEX_SYNC_HANDOFF_TARGET = Object.freeze({
        name: "production",
        origin: "https://www.perks-reminder.com",
        path: AMEX_SYNC_HANDOFF_PATH
      });
      LOCAL_AMEX_SYNC_HANDOFF_TARGET = Object.freeze({
        name: "local",
        origin: "http://localhost:3000",
        path: AMEX_SYNC_HANDOFF_PATH
      });
    }
  });

  // node_modules/zod/lib/index.mjs
  function setErrorMap(map) {
    overrideErrorMap = map;
  }
  function getErrorMap() {
    return overrideErrorMap;
  }
  function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
      issueData,
      data: ctx.data,
      path: ctx.path,
      errorMaps: [
        ctx.common.contextualErrorMap,
        // contextual error map is first priority
        ctx.schemaErrorMap,
        // then schema-bound map if available
        overrideMap,
        // then global override map
        overrideMap === errorMap ? void 0 : errorMap
        // then global default map
      ].filter((x) => !!x)
    });
    ctx.common.issues.push(issue);
  }
  function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
  }
  function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
  }
  function processCreateParams(params) {
    if (!params)
      return {};
    const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
    if (errorMap2 && (invalid_type_error || required_error)) {
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap2)
      return { errorMap: errorMap2, description };
    const customMap = (iss, ctx) => {
      var _a, _b;
      const { message } = params;
      if (iss.code === "invalid_enum_value") {
        return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
      }
      if (typeof ctx.data === "undefined") {
        return { message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError };
      }
      if (iss.code !== "invalid_type")
        return { message: ctx.defaultError };
      return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
    };
    return { errorMap: customMap, description };
  }
  function timeRegexSource(args) {
    let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
    if (args.precision) {
      regex = `${regex}\\.\\d{${args.precision}}`;
    } else if (args.precision == null) {
      regex = `${regex}(\\.\\d+)?`;
    }
    return regex;
  }
  function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
  }
  function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
      opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
  }
  function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
      return true;
    }
    return false;
  }
  function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
      return false;
    try {
      const [header] = jwt.split(".");
      const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
      const decoded = JSON.parse(atob(base64));
      if (typeof decoded !== "object" || decoded === null)
        return false;
      if (!decoded.typ || !decoded.alg)
        return false;
      if (alg && decoded.alg !== alg)
        return false;
      return true;
    } catch (_a) {
      return false;
    }
  }
  function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
      return true;
    }
    return false;
  }
  function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / Math.pow(10, decCount);
  }
  function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
      const newShape = {};
      for (const key in schema.shape) {
        const fieldSchema = schema.shape[key];
        newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
      }
      return new ZodObject({
        ...schema._def,
        shape: () => newShape
      });
    } else if (schema instanceof ZodArray) {
      return new ZodArray({
        ...schema._def,
        type: deepPartialify(schema.element)
      });
    } else if (schema instanceof ZodOptional) {
      return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
      return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
      return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    } else {
      return schema;
    }
  }
  function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
      return { valid: true, data: a };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
      const bKeys = util.objectKeys(b);
      const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = { ...a, ...b };
      for (const key of sharedKeys) {
        const sharedValue = mergeValues(a[key], b[key]);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
      if (a.length !== b.length) {
        return { valid: false };
      }
      const newArray = [];
      for (let index = 0; index < a.length; index++) {
        const itemA = a[index];
        const itemB = b[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
      return { valid: true, data: a };
    } else {
      return { valid: false };
    }
  }
  function createZodEnum(values, params) {
    return new ZodEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodEnum,
      ...processCreateParams(params)
    });
  }
  function cleanParams(params, data) {
    const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
    const p2 = typeof p === "string" ? { message: p } : p;
    return p2;
  }
  function custom(check, _params = {}, fatal) {
    if (check)
      return ZodAny.create().superRefine((data, ctx) => {
        var _a, _b;
        const r = check(data);
        if (r instanceof Promise) {
          return r.then((r2) => {
            var _a2, _b2;
            if (!r2) {
              const params = cleanParams(_params, data);
              const _fatal = (_b2 = (_a2 = params.fatal) !== null && _a2 !== void 0 ? _a2 : fatal) !== null && _b2 !== void 0 ? _b2 : true;
              ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
            }
          });
        }
        if (!r) {
          const params = cleanParams(_params, data);
          const _fatal = (_b = (_a = params.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
          ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
        }
        return;
      });
    return ZodAny.create();
  }
  var util, objectUtil, ZodParsedType, getParsedType, ZodIssueCode, quotelessJson, ZodError, errorMap, overrideErrorMap, makeIssue, EMPTY_PATH, ParseStatus, INVALID, DIRTY, OK, isAborted, isDirty, isValid, isAsync, errorUtil, _ZodEnum_cache, _ZodNativeEnum_cache, ParseInputLazyPath, handleResult, ZodType, cuidRegex, cuid2Regex, ulidRegex, uuidRegex, nanoidRegex, jwtRegex, durationRegex, emailRegex, _emojiRegex, emojiRegex, ipv4Regex, ipv4CidrRegex, ipv6Regex, ipv6CidrRegex, base64Regex, base64urlRegex, dateRegexSource, dateRegex, ZodString, ZodNumber, ZodBigInt, ZodBoolean, ZodDate, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodArray, ZodObject, ZodUnion, getDiscriminator, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodFunction, ZodLazy, ZodLiteral, ZodEnum, ZodNativeEnum, ZodPromise, ZodEffects, ZodOptional, ZodNullable, ZodDefault, ZodCatch, ZodNaN, BRAND, ZodBranded, ZodPipeline, ZodReadonly, late, ZodFirstPartyTypeKind, instanceOfType, stringType, numberType, nanType, bigIntType, booleanType, dateType, symbolType, undefinedType, nullType, anyType, unknownType, neverType, voidType, arrayType, objectType, strictObjectType, unionType, discriminatedUnionType, intersectionType, tupleType, recordType, mapType, setType, functionType, lazyType, literalType, enumType, nativeEnumType, promiseType, effectsType, optionalType, nullableType, preprocessType, pipelineType, ostring, onumber, oboolean, coerce, NEVER, z;
  var init_lib = __esm({
    "node_modules/zod/lib/index.mjs"() {
      "use strict";
      (function(util2) {
        util2.assertEqual = (val) => val;
        function assertIs(_arg) {
        }
        util2.assertIs = assertIs;
        function assertNever(_x) {
          throw new Error();
        }
        util2.assertNever = assertNever;
        util2.arrayToEnum = (items) => {
          const obj = {};
          for (const item of items) {
            obj[item] = item;
          }
          return obj;
        };
        util2.getValidEnumValues = (obj) => {
          const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
          const filtered = {};
          for (const k of validKeys) {
            filtered[k] = obj[k];
          }
          return util2.objectValues(filtered);
        };
        util2.objectValues = (obj) => {
          return util2.objectKeys(obj).map(function(e) {
            return obj[e];
          });
        };
        util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
          const keys = [];
          for (const key in object) {
            if (Object.prototype.hasOwnProperty.call(object, key)) {
              keys.push(key);
            }
          }
          return keys;
        };
        util2.find = (arr, checker) => {
          for (const item of arr) {
            if (checker(item))
              return item;
          }
          return void 0;
        };
        util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
        function joinValues(array, separator = " | ") {
          return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
        }
        util2.joinValues = joinValues;
        util2.jsonStringifyReplacer = (_, value) => {
          if (typeof value === "bigint") {
            return value.toString();
          }
          return value;
        };
      })(util || (util = {}));
      (function(objectUtil2) {
        objectUtil2.mergeShapes = (first, second) => {
          return {
            ...first,
            ...second
            // second overwrites first
          };
        };
      })(objectUtil || (objectUtil = {}));
      ZodParsedType = util.arrayToEnum([
        "string",
        "nan",
        "number",
        "integer",
        "float",
        "boolean",
        "date",
        "bigint",
        "symbol",
        "function",
        "undefined",
        "null",
        "array",
        "object",
        "unknown",
        "promise",
        "void",
        "never",
        "map",
        "set"
      ]);
      getParsedType = (data) => {
        const t = typeof data;
        switch (t) {
          case "undefined":
            return ZodParsedType.undefined;
          case "string":
            return ZodParsedType.string;
          case "number":
            return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
          case "boolean":
            return ZodParsedType.boolean;
          case "function":
            return ZodParsedType.function;
          case "bigint":
            return ZodParsedType.bigint;
          case "symbol":
            return ZodParsedType.symbol;
          case "object":
            if (Array.isArray(data)) {
              return ZodParsedType.array;
            }
            if (data === null) {
              return ZodParsedType.null;
            }
            if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
              return ZodParsedType.promise;
            }
            if (typeof Map !== "undefined" && data instanceof Map) {
              return ZodParsedType.map;
            }
            if (typeof Set !== "undefined" && data instanceof Set) {
              return ZodParsedType.set;
            }
            if (typeof Date !== "undefined" && data instanceof Date) {
              return ZodParsedType.date;
            }
            return ZodParsedType.object;
          default:
            return ZodParsedType.unknown;
        }
      };
      ZodIssueCode = util.arrayToEnum([
        "invalid_type",
        "invalid_literal",
        "custom",
        "invalid_union",
        "invalid_union_discriminator",
        "invalid_enum_value",
        "unrecognized_keys",
        "invalid_arguments",
        "invalid_return_type",
        "invalid_date",
        "invalid_string",
        "too_small",
        "too_big",
        "invalid_intersection_types",
        "not_multiple_of",
        "not_finite"
      ]);
      quotelessJson = (obj) => {
        const json = JSON.stringify(obj, null, 2);
        return json.replace(/"([^"]+)":/g, "$1:");
      };
      ZodError = class _ZodError extends Error {
        get errors() {
          return this.issues;
        }
        constructor(issues) {
          super();
          this.issues = [];
          this.addIssue = (sub) => {
            this.issues = [...this.issues, sub];
          };
          this.addIssues = (subs = []) => {
            this.issues = [...this.issues, ...subs];
          };
          const actualProto = new.target.prototype;
          if (Object.setPrototypeOf) {
            Object.setPrototypeOf(this, actualProto);
          } else {
            this.__proto__ = actualProto;
          }
          this.name = "ZodError";
          this.issues = issues;
        }
        format(_mapper) {
          const mapper = _mapper || function(issue) {
            return issue.message;
          };
          const fieldErrors = { _errors: [] };
          const processError = (error) => {
            for (const issue of error.issues) {
              if (issue.code === "invalid_union") {
                issue.unionErrors.map(processError);
              } else if (issue.code === "invalid_return_type") {
                processError(issue.returnTypeError);
              } else if (issue.code === "invalid_arguments") {
                processError(issue.argumentsError);
              } else if (issue.path.length === 0) {
                fieldErrors._errors.push(mapper(issue));
              } else {
                let curr = fieldErrors;
                let i = 0;
                while (i < issue.path.length) {
                  const el = issue.path[i];
                  const terminal = i === issue.path.length - 1;
                  if (!terminal) {
                    curr[el] = curr[el] || { _errors: [] };
                  } else {
                    curr[el] = curr[el] || { _errors: [] };
                    curr[el]._errors.push(mapper(issue));
                  }
                  curr = curr[el];
                  i++;
                }
              }
            }
          };
          processError(this);
          return fieldErrors;
        }
        static assert(value) {
          if (!(value instanceof _ZodError)) {
            throw new Error(`Not a ZodError: ${value}`);
          }
        }
        toString() {
          return this.message;
        }
        get message() {
          return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
        }
        get isEmpty() {
          return this.issues.length === 0;
        }
        flatten(mapper = (issue) => issue.message) {
          const fieldErrors = {};
          const formErrors = [];
          for (const sub of this.issues) {
            if (sub.path.length > 0) {
              fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
              fieldErrors[sub.path[0]].push(mapper(sub));
            } else {
              formErrors.push(mapper(sub));
            }
          }
          return { formErrors, fieldErrors };
        }
        get formErrors() {
          return this.flatten();
        }
      };
      ZodError.create = (issues) => {
        const error = new ZodError(issues);
        return error;
      };
      errorMap = (issue, _ctx) => {
        let message;
        switch (issue.code) {
          case ZodIssueCode.invalid_type:
            if (issue.received === ZodParsedType.undefined) {
              message = "Required";
            } else {
              message = `Expected ${issue.expected}, received ${issue.received}`;
            }
            break;
          case ZodIssueCode.invalid_literal:
            message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
            break;
          case ZodIssueCode.unrecognized_keys:
            message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
            break;
          case ZodIssueCode.invalid_union:
            message = `Invalid input`;
            break;
          case ZodIssueCode.invalid_union_discriminator:
            message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
            break;
          case ZodIssueCode.invalid_enum_value:
            message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
            break;
          case ZodIssueCode.invalid_arguments:
            message = `Invalid function arguments`;
            break;
          case ZodIssueCode.invalid_return_type:
            message = `Invalid function return type`;
            break;
          case ZodIssueCode.invalid_date:
            message = `Invalid date`;
            break;
          case ZodIssueCode.invalid_string:
            if (typeof issue.validation === "object") {
              if ("includes" in issue.validation) {
                message = `Invalid input: must include "${issue.validation.includes}"`;
                if (typeof issue.validation.position === "number") {
                  message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
                }
              } else if ("startsWith" in issue.validation) {
                message = `Invalid input: must start with "${issue.validation.startsWith}"`;
              } else if ("endsWith" in issue.validation) {
                message = `Invalid input: must end with "${issue.validation.endsWith}"`;
              } else {
                util.assertNever(issue.validation);
              }
            } else if (issue.validation !== "regex") {
              message = `Invalid ${issue.validation}`;
            } else {
              message = "Invalid";
            }
            break;
          case ZodIssueCode.too_small:
            if (issue.type === "array")
              message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
            else if (issue.type === "string")
              message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
            else if (issue.type === "number")
              message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
            else if (issue.type === "date")
              message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
            else
              message = "Invalid input";
            break;
          case ZodIssueCode.too_big:
            if (issue.type === "array")
              message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
            else if (issue.type === "string")
              message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
            else if (issue.type === "number")
              message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "bigint")
              message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
            else if (issue.type === "date")
              message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
            else
              message = "Invalid input";
            break;
          case ZodIssueCode.custom:
            message = `Invalid input`;
            break;
          case ZodIssueCode.invalid_intersection_types:
            message = `Intersection results could not be merged`;
            break;
          case ZodIssueCode.not_multiple_of:
            message = `Number must be a multiple of ${issue.multipleOf}`;
            break;
          case ZodIssueCode.not_finite:
            message = "Number must be finite";
            break;
          default:
            message = _ctx.defaultError;
            util.assertNever(issue);
        }
        return { message };
      };
      overrideErrorMap = errorMap;
      makeIssue = (params) => {
        const { data, path, errorMaps, issueData } = params;
        const fullPath = [...path, ...issueData.path || []];
        const fullIssue = {
          ...issueData,
          path: fullPath
        };
        if (issueData.message !== void 0) {
          return {
            ...issueData,
            path: fullPath,
            message: issueData.message
          };
        }
        let errorMessage = "";
        const maps = errorMaps.filter((m) => !!m).slice().reverse();
        for (const map of maps) {
          errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
        }
        return {
          ...issueData,
          path: fullPath,
          message: errorMessage
        };
      };
      EMPTY_PATH = [];
      ParseStatus = class _ParseStatus {
        constructor() {
          this.value = "valid";
        }
        dirty() {
          if (this.value === "valid")
            this.value = "dirty";
        }
        abort() {
          if (this.value !== "aborted")
            this.value = "aborted";
        }
        static mergeArray(status, results) {
          const arrayValue = [];
          for (const s of results) {
            if (s.status === "aborted")
              return INVALID;
            if (s.status === "dirty")
              status.dirty();
            arrayValue.push(s.value);
          }
          return { status: status.value, value: arrayValue };
        }
        static async mergeObjectAsync(status, pairs) {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value
            });
          }
          return _ParseStatus.mergeObjectSync(status, syncPairs);
        }
        static mergeObjectSync(status, pairs) {
          const finalObject = {};
          for (const pair of pairs) {
            const { key, value } = pair;
            if (key.status === "aborted")
              return INVALID;
            if (value.status === "aborted")
              return INVALID;
            if (key.status === "dirty")
              status.dirty();
            if (value.status === "dirty")
              status.dirty();
            if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
              finalObject[key.value] = value.value;
            }
          }
          return { status: status.value, value: finalObject };
        }
      };
      INVALID = Object.freeze({
        status: "aborted"
      });
      DIRTY = (value) => ({ status: "dirty", value });
      OK = (value) => ({ status: "valid", value });
      isAborted = (x) => x.status === "aborted";
      isDirty = (x) => x.status === "dirty";
      isValid = (x) => x.status === "valid";
      isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
      (function(errorUtil2) {
        errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
        errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
      })(errorUtil || (errorUtil = {}));
      ParseInputLazyPath = class {
        constructor(parent, value, path, key) {
          this._cachedPath = [];
          this.parent = parent;
          this.data = value;
          this._path = path;
          this._key = key;
        }
        get path() {
          if (!this._cachedPath.length) {
            if (this._key instanceof Array) {
              this._cachedPath.push(...this._path, ...this._key);
            } else {
              this._cachedPath.push(...this._path, this._key);
            }
          }
          return this._cachedPath;
        }
      };
      handleResult = (ctx, result) => {
        if (isValid(result)) {
          return { success: true, data: result.value };
        } else {
          if (!ctx.common.issues.length) {
            throw new Error("Validation failed but no issues detected.");
          }
          return {
            success: false,
            get error() {
              if (this._error)
                return this._error;
              const error = new ZodError(ctx.common.issues);
              this._error = error;
              return this._error;
            }
          };
        }
      };
      ZodType = class {
        get description() {
          return this._def.description;
        }
        _getType(input) {
          return getParsedType(input.data);
        }
        _getOrReturnCtx(input, ctx) {
          return ctx || {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent
          };
        }
        _processInputParams(input) {
          return {
            status: new ParseStatus(),
            ctx: {
              common: input.parent.common,
              data: input.data,
              parsedType: getParsedType(input.data),
              schemaErrorMap: this._def.errorMap,
              path: input.path,
              parent: input.parent
            }
          };
        }
        _parseSync(input) {
          const result = this._parse(input);
          if (isAsync(result)) {
            throw new Error("Synchronous parse encountered promise.");
          }
          return result;
        }
        _parseAsync(input) {
          const result = this._parse(input);
          return Promise.resolve(result);
        }
        parse(data, params) {
          const result = this.safeParse(data, params);
          if (result.success)
            return result.data;
          throw result.error;
        }
        safeParse(data, params) {
          var _a;
          const ctx = {
            common: {
              issues: [],
              async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
              contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
            },
            path: (params === null || params === void 0 ? void 0 : params.path) || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data)
          };
          const result = this._parseSync({ data, path: ctx.path, parent: ctx });
          return handleResult(ctx, result);
        }
        "~validate"(data) {
          var _a, _b;
          const ctx = {
            common: {
              issues: [],
              async: !!this["~standard"].async
            },
            path: [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data)
          };
          if (!this["~standard"].async) {
            try {
              const result = this._parseSync({ data, path: [], parent: ctx });
              return isValid(result) ? {
                value: result.value
              } : {
                issues: ctx.common.issues
              };
            } catch (err) {
              if ((_b = (_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === null || _b === void 0 ? void 0 : _b.includes("encountered")) {
                this["~standard"].async = true;
              }
              ctx.common = {
                issues: [],
                async: true
              };
            }
          }
          return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
            value: result.value
          } : {
            issues: ctx.common.issues
          });
        }
        async parseAsync(data, params) {
          const result = await this.safeParseAsync(data, params);
          if (result.success)
            return result.data;
          throw result.error;
        }
        async safeParseAsync(data, params) {
          const ctx = {
            common: {
              issues: [],
              contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
              async: true
            },
            path: (params === null || params === void 0 ? void 0 : params.path) || [],
            schemaErrorMap: this._def.errorMap,
            parent: null,
            data,
            parsedType: getParsedType(data)
          };
          const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
          const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
          return handleResult(ctx, result);
        }
        refine(check, message) {
          const getIssueProperties = (val) => {
            if (typeof message === "string" || typeof message === "undefined") {
              return { message };
            } else if (typeof message === "function") {
              return message(val);
            } else {
              return message;
            }
          };
          return this._refinement((val, ctx) => {
            const result = check(val);
            const setError = () => ctx.addIssue({
              code: ZodIssueCode.custom,
              ...getIssueProperties(val)
            });
            if (typeof Promise !== "undefined" && result instanceof Promise) {
              return result.then((data) => {
                if (!data) {
                  setError();
                  return false;
                } else {
                  return true;
                }
              });
            }
            if (!result) {
              setError();
              return false;
            } else {
              return true;
            }
          });
        }
        refinement(check, refinementData) {
          return this._refinement((val, ctx) => {
            if (!check(val)) {
              ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
              return false;
            } else {
              return true;
            }
          });
        }
        _refinement(refinement) {
          return new ZodEffects({
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "refinement", refinement }
          });
        }
        superRefine(refinement) {
          return this._refinement(refinement);
        }
        constructor(def) {
          this.spa = this.safeParseAsync;
          this._def = def;
          this.parse = this.parse.bind(this);
          this.safeParse = this.safeParse.bind(this);
          this.parseAsync = this.parseAsync.bind(this);
          this.safeParseAsync = this.safeParseAsync.bind(this);
          this.spa = this.spa.bind(this);
          this.refine = this.refine.bind(this);
          this.refinement = this.refinement.bind(this);
          this.superRefine = this.superRefine.bind(this);
          this.optional = this.optional.bind(this);
          this.nullable = this.nullable.bind(this);
          this.nullish = this.nullish.bind(this);
          this.array = this.array.bind(this);
          this.promise = this.promise.bind(this);
          this.or = this.or.bind(this);
          this.and = this.and.bind(this);
          this.transform = this.transform.bind(this);
          this.brand = this.brand.bind(this);
          this.default = this.default.bind(this);
          this.catch = this.catch.bind(this);
          this.describe = this.describe.bind(this);
          this.pipe = this.pipe.bind(this);
          this.readonly = this.readonly.bind(this);
          this.isNullable = this.isNullable.bind(this);
          this.isOptional = this.isOptional.bind(this);
          this["~standard"] = {
            version: 1,
            vendor: "zod",
            validate: (data) => this["~validate"](data)
          };
        }
        optional() {
          return ZodOptional.create(this, this._def);
        }
        nullable() {
          return ZodNullable.create(this, this._def);
        }
        nullish() {
          return this.nullable().optional();
        }
        array() {
          return ZodArray.create(this);
        }
        promise() {
          return ZodPromise.create(this, this._def);
        }
        or(option) {
          return ZodUnion.create([this, option], this._def);
        }
        and(incoming) {
          return ZodIntersection.create(this, incoming, this._def);
        }
        transform(transform) {
          return new ZodEffects({
            ...processCreateParams(this._def),
            schema: this,
            typeName: ZodFirstPartyTypeKind.ZodEffects,
            effect: { type: "transform", transform }
          });
        }
        default(def) {
          const defaultValueFunc = typeof def === "function" ? def : () => def;
          return new ZodDefault({
            ...processCreateParams(this._def),
            innerType: this,
            defaultValue: defaultValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodDefault
          });
        }
        brand() {
          return new ZodBranded({
            typeName: ZodFirstPartyTypeKind.ZodBranded,
            type: this,
            ...processCreateParams(this._def)
          });
        }
        catch(def) {
          const catchValueFunc = typeof def === "function" ? def : () => def;
          return new ZodCatch({
            ...processCreateParams(this._def),
            innerType: this,
            catchValue: catchValueFunc,
            typeName: ZodFirstPartyTypeKind.ZodCatch
          });
        }
        describe(description) {
          const This = this.constructor;
          return new This({
            ...this._def,
            description
          });
        }
        pipe(target) {
          return ZodPipeline.create(this, target);
        }
        readonly() {
          return ZodReadonly.create(this);
        }
        isOptional() {
          return this.safeParse(void 0).success;
        }
        isNullable() {
          return this.safeParse(null).success;
        }
      };
      cuidRegex = /^c[^\s-]{8,}$/i;
      cuid2Regex = /^[0-9a-z]+$/;
      ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
      uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
      nanoidRegex = /^[a-z0-9_-]{21}$/i;
      jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
      durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
      emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
      _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
      ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
      ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
      ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
      base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
      base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
      dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
      dateRegex = new RegExp(`^${dateRegexSource}$`);
      ZodString = class _ZodString extends ZodType {
        _parse(input) {
          if (this._def.coerce) {
            input.data = String(input.data);
          }
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.string) {
            const ctx2 = this._getOrReturnCtx(input);
            addIssueToContext(ctx2, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.string,
              received: ctx2.parsedType
            });
            return INVALID;
          }
          const status = new ParseStatus();
          let ctx = void 0;
          for (const check of this._def.checks) {
            if (check.kind === "min") {
              if (input.data.length < check.value) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  minimum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: false,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "max") {
              if (input.data.length > check.value) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  maximum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: false,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "length") {
              const tooBig = input.data.length > check.value;
              const tooSmall = input.data.length < check.value;
              if (tooBig || tooSmall) {
                ctx = this._getOrReturnCtx(input, ctx);
                if (tooBig) {
                  addIssueToContext(ctx, {
                    code: ZodIssueCode.too_big,
                    maximum: check.value,
                    type: "string",
                    inclusive: true,
                    exact: true,
                    message: check.message
                  });
                } else if (tooSmall) {
                  addIssueToContext(ctx, {
                    code: ZodIssueCode.too_small,
                    minimum: check.value,
                    type: "string",
                    inclusive: true,
                    exact: true,
                    message: check.message
                  });
                }
                status.dirty();
              }
            } else if (check.kind === "email") {
              if (!emailRegex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "email",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "emoji") {
              if (!emojiRegex) {
                emojiRegex = new RegExp(_emojiRegex, "u");
              }
              if (!emojiRegex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "emoji",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "uuid") {
              if (!uuidRegex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "uuid",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "nanoid") {
              if (!nanoidRegex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "nanoid",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "cuid") {
              if (!cuidRegex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "cuid",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "cuid2") {
              if (!cuid2Regex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "cuid2",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "ulid") {
              if (!ulidRegex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "ulid",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "url") {
              try {
                new URL(input.data);
              } catch (_a) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "url",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "regex") {
              check.regex.lastIndex = 0;
              const testResult = check.regex.test(input.data);
              if (!testResult) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "regex",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "trim") {
              input.data = input.data.trim();
            } else if (check.kind === "includes") {
              if (!input.data.includes(check.value, check.position)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.invalid_string,
                  validation: { includes: check.value, position: check.position },
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "toLowerCase") {
              input.data = input.data.toLowerCase();
            } else if (check.kind === "toUpperCase") {
              input.data = input.data.toUpperCase();
            } else if (check.kind === "startsWith") {
              if (!input.data.startsWith(check.value)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.invalid_string,
                  validation: { startsWith: check.value },
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "endsWith") {
              if (!input.data.endsWith(check.value)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.invalid_string,
                  validation: { endsWith: check.value },
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "datetime") {
              const regex = datetimeRegex(check);
              if (!regex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.invalid_string,
                  validation: "datetime",
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "date") {
              const regex = dateRegex;
              if (!regex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.invalid_string,
                  validation: "date",
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "time") {
              const regex = timeRegex(check);
              if (!regex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.invalid_string,
                  validation: "time",
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "duration") {
              if (!durationRegex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "duration",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "ip") {
              if (!isValidIP(input.data, check.version)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "ip",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "jwt") {
              if (!isValidJWT(input.data, check.alg)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "jwt",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "cidr") {
              if (!isValidCidr(input.data, check.version)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "cidr",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "base64") {
              if (!base64Regex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "base64",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "base64url") {
              if (!base64urlRegex.test(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  validation: "base64url",
                  code: ZodIssueCode.invalid_string,
                  message: check.message
                });
                status.dirty();
              }
            } else {
              util.assertNever(check);
            }
          }
          return { status: status.value, value: input.data };
        }
        _regex(regex, validation, message) {
          return this.refinement((data) => regex.test(data), {
            validation,
            code: ZodIssueCode.invalid_string,
            ...errorUtil.errToObj(message)
          });
        }
        _addCheck(check) {
          return new _ZodString({
            ...this._def,
            checks: [...this._def.checks, check]
          });
        }
        email(message) {
          return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
        }
        url(message) {
          return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
        }
        emoji(message) {
          return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
        }
        uuid(message) {
          return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
        }
        nanoid(message) {
          return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
        }
        cuid(message) {
          return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
        }
        cuid2(message) {
          return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
        }
        ulid(message) {
          return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
        }
        base64(message) {
          return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
        }
        base64url(message) {
          return this._addCheck({
            kind: "base64url",
            ...errorUtil.errToObj(message)
          });
        }
        jwt(options) {
          return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
        }
        ip(options) {
          return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
        }
        cidr(options) {
          return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
        }
        datetime(options) {
          var _a, _b;
          if (typeof options === "string") {
            return this._addCheck({
              kind: "datetime",
              precision: null,
              offset: false,
              local: false,
              message: options
            });
          }
          return this._addCheck({
            kind: "datetime",
            precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
            offset: (_a = options === null || options === void 0 ? void 0 : options.offset) !== null && _a !== void 0 ? _a : false,
            local: (_b = options === null || options === void 0 ? void 0 : options.local) !== null && _b !== void 0 ? _b : false,
            ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
          });
        }
        date(message) {
          return this._addCheck({ kind: "date", message });
        }
        time(options) {
          if (typeof options === "string") {
            return this._addCheck({
              kind: "time",
              precision: null,
              message: options
            });
          }
          return this._addCheck({
            kind: "time",
            precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
            ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
          });
        }
        duration(message) {
          return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
        }
        regex(regex, message) {
          return this._addCheck({
            kind: "regex",
            regex,
            ...errorUtil.errToObj(message)
          });
        }
        includes(value, options) {
          return this._addCheck({
            kind: "includes",
            value,
            position: options === null || options === void 0 ? void 0 : options.position,
            ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
          });
        }
        startsWith(value, message) {
          return this._addCheck({
            kind: "startsWith",
            value,
            ...errorUtil.errToObj(message)
          });
        }
        endsWith(value, message) {
          return this._addCheck({
            kind: "endsWith",
            value,
            ...errorUtil.errToObj(message)
          });
        }
        min(minLength, message) {
          return this._addCheck({
            kind: "min",
            value: minLength,
            ...errorUtil.errToObj(message)
          });
        }
        max(maxLength, message) {
          return this._addCheck({
            kind: "max",
            value: maxLength,
            ...errorUtil.errToObj(message)
          });
        }
        length(len, message) {
          return this._addCheck({
            kind: "length",
            value: len,
            ...errorUtil.errToObj(message)
          });
        }
        /**
         * Equivalent to `.min(1)`
         */
        nonempty(message) {
          return this.min(1, errorUtil.errToObj(message));
        }
        trim() {
          return new _ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "trim" }]
          });
        }
        toLowerCase() {
          return new _ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toLowerCase" }]
          });
        }
        toUpperCase() {
          return new _ZodString({
            ...this._def,
            checks: [...this._def.checks, { kind: "toUpperCase" }]
          });
        }
        get isDatetime() {
          return !!this._def.checks.find((ch) => ch.kind === "datetime");
        }
        get isDate() {
          return !!this._def.checks.find((ch) => ch.kind === "date");
        }
        get isTime() {
          return !!this._def.checks.find((ch) => ch.kind === "time");
        }
        get isDuration() {
          return !!this._def.checks.find((ch) => ch.kind === "duration");
        }
        get isEmail() {
          return !!this._def.checks.find((ch) => ch.kind === "email");
        }
        get isURL() {
          return !!this._def.checks.find((ch) => ch.kind === "url");
        }
        get isEmoji() {
          return !!this._def.checks.find((ch) => ch.kind === "emoji");
        }
        get isUUID() {
          return !!this._def.checks.find((ch) => ch.kind === "uuid");
        }
        get isNANOID() {
          return !!this._def.checks.find((ch) => ch.kind === "nanoid");
        }
        get isCUID() {
          return !!this._def.checks.find((ch) => ch.kind === "cuid");
        }
        get isCUID2() {
          return !!this._def.checks.find((ch) => ch.kind === "cuid2");
        }
        get isULID() {
          return !!this._def.checks.find((ch) => ch.kind === "ulid");
        }
        get isIP() {
          return !!this._def.checks.find((ch) => ch.kind === "ip");
        }
        get isCIDR() {
          return !!this._def.checks.find((ch) => ch.kind === "cidr");
        }
        get isBase64() {
          return !!this._def.checks.find((ch) => ch.kind === "base64");
        }
        get isBase64url() {
          return !!this._def.checks.find((ch) => ch.kind === "base64url");
        }
        get minLength() {
          let min = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "min") {
              if (min === null || ch.value > min)
                min = ch.value;
            }
          }
          return min;
        }
        get maxLength() {
          let max = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "max") {
              if (max === null || ch.value < max)
                max = ch.value;
            }
          }
          return max;
        }
      };
      ZodString.create = (params) => {
        var _a;
        return new ZodString({
          checks: [],
          typeName: ZodFirstPartyTypeKind.ZodString,
          coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
          ...processCreateParams(params)
        });
      };
      ZodNumber = class _ZodNumber extends ZodType {
        constructor() {
          super(...arguments);
          this.min = this.gte;
          this.max = this.lte;
          this.step = this.multipleOf;
        }
        _parse(input) {
          if (this._def.coerce) {
            input.data = Number(input.data);
          }
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.number) {
            const ctx2 = this._getOrReturnCtx(input);
            addIssueToContext(ctx2, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.number,
              received: ctx2.parsedType
            });
            return INVALID;
          }
          let ctx = void 0;
          const status = new ParseStatus();
          for (const check of this._def.checks) {
            if (check.kind === "int") {
              if (!util.isInteger(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.invalid_type,
                  expected: "integer",
                  received: "float",
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "min") {
              const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
              if (tooSmall) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  minimum: check.value,
                  type: "number",
                  inclusive: check.inclusive,
                  exact: false,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "max") {
              const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
              if (tooBig) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  maximum: check.value,
                  type: "number",
                  inclusive: check.inclusive,
                  exact: false,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "multipleOf") {
              if (floatSafeRemainder(input.data, check.value) !== 0) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.not_multiple_of,
                  multipleOf: check.value,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "finite") {
              if (!Number.isFinite(input.data)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.not_finite,
                  message: check.message
                });
                status.dirty();
              }
            } else {
              util.assertNever(check);
            }
          }
          return { status: status.value, value: input.data };
        }
        gte(value, message) {
          return this.setLimit("min", value, true, errorUtil.toString(message));
        }
        gt(value, message) {
          return this.setLimit("min", value, false, errorUtil.toString(message));
        }
        lte(value, message) {
          return this.setLimit("max", value, true, errorUtil.toString(message));
        }
        lt(value, message) {
          return this.setLimit("max", value, false, errorUtil.toString(message));
        }
        setLimit(kind, value, inclusive, message) {
          return new _ZodNumber({
            ...this._def,
            checks: [
              ...this._def.checks,
              {
                kind,
                value,
                inclusive,
                message: errorUtil.toString(message)
              }
            ]
          });
        }
        _addCheck(check) {
          return new _ZodNumber({
            ...this._def,
            checks: [...this._def.checks, check]
          });
        }
        int(message) {
          return this._addCheck({
            kind: "int",
            message: errorUtil.toString(message)
          });
        }
        positive(message) {
          return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message)
          });
        }
        negative(message) {
          return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: false,
            message: errorUtil.toString(message)
          });
        }
        nonpositive(message) {
          return this._addCheck({
            kind: "max",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message)
          });
        }
        nonnegative(message) {
          return this._addCheck({
            kind: "min",
            value: 0,
            inclusive: true,
            message: errorUtil.toString(message)
          });
        }
        multipleOf(value, message) {
          return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil.toString(message)
          });
        }
        finite(message) {
          return this._addCheck({
            kind: "finite",
            message: errorUtil.toString(message)
          });
        }
        safe(message) {
          return this._addCheck({
            kind: "min",
            inclusive: true,
            value: Number.MIN_SAFE_INTEGER,
            message: errorUtil.toString(message)
          })._addCheck({
            kind: "max",
            inclusive: true,
            value: Number.MAX_SAFE_INTEGER,
            message: errorUtil.toString(message)
          });
        }
        get minValue() {
          let min = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "min") {
              if (min === null || ch.value > min)
                min = ch.value;
            }
          }
          return min;
        }
        get maxValue() {
          let max = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "max") {
              if (max === null || ch.value < max)
                max = ch.value;
            }
          }
          return max;
        }
        get isInt() {
          return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
        }
        get isFinite() {
          let max = null, min = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
              return true;
            } else if (ch.kind === "min") {
              if (min === null || ch.value > min)
                min = ch.value;
            } else if (ch.kind === "max") {
              if (max === null || ch.value < max)
                max = ch.value;
            }
          }
          return Number.isFinite(min) && Number.isFinite(max);
        }
      };
      ZodNumber.create = (params) => {
        return new ZodNumber({
          checks: [],
          typeName: ZodFirstPartyTypeKind.ZodNumber,
          coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
          ...processCreateParams(params)
        });
      };
      ZodBigInt = class _ZodBigInt extends ZodType {
        constructor() {
          super(...arguments);
          this.min = this.gte;
          this.max = this.lte;
        }
        _parse(input) {
          if (this._def.coerce) {
            try {
              input.data = BigInt(input.data);
            } catch (_a) {
              return this._getInvalidInput(input);
            }
          }
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.bigint) {
            return this._getInvalidInput(input);
          }
          let ctx = void 0;
          const status = new ParseStatus();
          for (const check of this._def.checks) {
            if (check.kind === "min") {
              const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
              if (tooSmall) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  type: "bigint",
                  minimum: check.value,
                  inclusive: check.inclusive,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "max") {
              const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
              if (tooBig) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  type: "bigint",
                  maximum: check.value,
                  inclusive: check.inclusive,
                  message: check.message
                });
                status.dirty();
              }
            } else if (check.kind === "multipleOf") {
              if (input.data % check.value !== BigInt(0)) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.not_multiple_of,
                  multipleOf: check.value,
                  message: check.message
                });
                status.dirty();
              }
            } else {
              util.assertNever(check);
            }
          }
          return { status: status.value, value: input.data };
        }
        _getInvalidInput(input) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.bigint,
            received: ctx.parsedType
          });
          return INVALID;
        }
        gte(value, message) {
          return this.setLimit("min", value, true, errorUtil.toString(message));
        }
        gt(value, message) {
          return this.setLimit("min", value, false, errorUtil.toString(message));
        }
        lte(value, message) {
          return this.setLimit("max", value, true, errorUtil.toString(message));
        }
        lt(value, message) {
          return this.setLimit("max", value, false, errorUtil.toString(message));
        }
        setLimit(kind, value, inclusive, message) {
          return new _ZodBigInt({
            ...this._def,
            checks: [
              ...this._def.checks,
              {
                kind,
                value,
                inclusive,
                message: errorUtil.toString(message)
              }
            ]
          });
        }
        _addCheck(check) {
          return new _ZodBigInt({
            ...this._def,
            checks: [...this._def.checks, check]
          });
        }
        positive(message) {
          return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message)
          });
        }
        negative(message) {
          return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: false,
            message: errorUtil.toString(message)
          });
        }
        nonpositive(message) {
          return this._addCheck({
            kind: "max",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message)
          });
        }
        nonnegative(message) {
          return this._addCheck({
            kind: "min",
            value: BigInt(0),
            inclusive: true,
            message: errorUtil.toString(message)
          });
        }
        multipleOf(value, message) {
          return this._addCheck({
            kind: "multipleOf",
            value,
            message: errorUtil.toString(message)
          });
        }
        get minValue() {
          let min = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "min") {
              if (min === null || ch.value > min)
                min = ch.value;
            }
          }
          return min;
        }
        get maxValue() {
          let max = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "max") {
              if (max === null || ch.value < max)
                max = ch.value;
            }
          }
          return max;
        }
      };
      ZodBigInt.create = (params) => {
        var _a;
        return new ZodBigInt({
          checks: [],
          typeName: ZodFirstPartyTypeKind.ZodBigInt,
          coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
          ...processCreateParams(params)
        });
      };
      ZodBoolean = class extends ZodType {
        _parse(input) {
          if (this._def.coerce) {
            input.data = Boolean(input.data);
          }
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.boolean) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.boolean,
              received: ctx.parsedType
            });
            return INVALID;
          }
          return OK(input.data);
        }
      };
      ZodBoolean.create = (params) => {
        return new ZodBoolean({
          typeName: ZodFirstPartyTypeKind.ZodBoolean,
          coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
          ...processCreateParams(params)
        });
      };
      ZodDate = class _ZodDate extends ZodType {
        _parse(input) {
          if (this._def.coerce) {
            input.data = new Date(input.data);
          }
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.date) {
            const ctx2 = this._getOrReturnCtx(input);
            addIssueToContext(ctx2, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.date,
              received: ctx2.parsedType
            });
            return INVALID;
          }
          if (isNaN(input.data.getTime())) {
            const ctx2 = this._getOrReturnCtx(input);
            addIssueToContext(ctx2, {
              code: ZodIssueCode.invalid_date
            });
            return INVALID;
          }
          const status = new ParseStatus();
          let ctx = void 0;
          for (const check of this._def.checks) {
            if (check.kind === "min") {
              if (input.data.getTime() < check.value) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  message: check.message,
                  inclusive: true,
                  exact: false,
                  minimum: check.value,
                  type: "date"
                });
                status.dirty();
              }
            } else if (check.kind === "max") {
              if (input.data.getTime() > check.value) {
                ctx = this._getOrReturnCtx(input, ctx);
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  message: check.message,
                  inclusive: true,
                  exact: false,
                  maximum: check.value,
                  type: "date"
                });
                status.dirty();
              }
            } else {
              util.assertNever(check);
            }
          }
          return {
            status: status.value,
            value: new Date(input.data.getTime())
          };
        }
        _addCheck(check) {
          return new _ZodDate({
            ...this._def,
            checks: [...this._def.checks, check]
          });
        }
        min(minDate, message) {
          return this._addCheck({
            kind: "min",
            value: minDate.getTime(),
            message: errorUtil.toString(message)
          });
        }
        max(maxDate, message) {
          return this._addCheck({
            kind: "max",
            value: maxDate.getTime(),
            message: errorUtil.toString(message)
          });
        }
        get minDate() {
          let min = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "min") {
              if (min === null || ch.value > min)
                min = ch.value;
            }
          }
          return min != null ? new Date(min) : null;
        }
        get maxDate() {
          let max = null;
          for (const ch of this._def.checks) {
            if (ch.kind === "max") {
              if (max === null || ch.value < max)
                max = ch.value;
            }
          }
          return max != null ? new Date(max) : null;
        }
      };
      ZodDate.create = (params) => {
        return new ZodDate({
          checks: [],
          coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
          typeName: ZodFirstPartyTypeKind.ZodDate,
          ...processCreateParams(params)
        });
      };
      ZodSymbol = class extends ZodType {
        _parse(input) {
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.symbol) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.symbol,
              received: ctx.parsedType
            });
            return INVALID;
          }
          return OK(input.data);
        }
      };
      ZodSymbol.create = (params) => {
        return new ZodSymbol({
          typeName: ZodFirstPartyTypeKind.ZodSymbol,
          ...processCreateParams(params)
        });
      };
      ZodUndefined = class extends ZodType {
        _parse(input) {
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.undefined,
              received: ctx.parsedType
            });
            return INVALID;
          }
          return OK(input.data);
        }
      };
      ZodUndefined.create = (params) => {
        return new ZodUndefined({
          typeName: ZodFirstPartyTypeKind.ZodUndefined,
          ...processCreateParams(params)
        });
      };
      ZodNull = class extends ZodType {
        _parse(input) {
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.null) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.null,
              received: ctx.parsedType
            });
            return INVALID;
          }
          return OK(input.data);
        }
      };
      ZodNull.create = (params) => {
        return new ZodNull({
          typeName: ZodFirstPartyTypeKind.ZodNull,
          ...processCreateParams(params)
        });
      };
      ZodAny = class extends ZodType {
        constructor() {
          super(...arguments);
          this._any = true;
        }
        _parse(input) {
          return OK(input.data);
        }
      };
      ZodAny.create = (params) => {
        return new ZodAny({
          typeName: ZodFirstPartyTypeKind.ZodAny,
          ...processCreateParams(params)
        });
      };
      ZodUnknown = class extends ZodType {
        constructor() {
          super(...arguments);
          this._unknown = true;
        }
        _parse(input) {
          return OK(input.data);
        }
      };
      ZodUnknown.create = (params) => {
        return new ZodUnknown({
          typeName: ZodFirstPartyTypeKind.ZodUnknown,
          ...processCreateParams(params)
        });
      };
      ZodNever = class extends ZodType {
        _parse(input) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.never,
            received: ctx.parsedType
          });
          return INVALID;
        }
      };
      ZodNever.create = (params) => {
        return new ZodNever({
          typeName: ZodFirstPartyTypeKind.ZodNever,
          ...processCreateParams(params)
        });
      };
      ZodVoid = class extends ZodType {
        _parse(input) {
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.undefined) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.void,
              received: ctx.parsedType
            });
            return INVALID;
          }
          return OK(input.data);
        }
      };
      ZodVoid.create = (params) => {
        return new ZodVoid({
          typeName: ZodFirstPartyTypeKind.ZodVoid,
          ...processCreateParams(params)
        });
      };
      ZodArray = class _ZodArray extends ZodType {
        _parse(input) {
          const { ctx, status } = this._processInputParams(input);
          const def = this._def;
          if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.array,
              received: ctx.parsedType
            });
            return INVALID;
          }
          if (def.exactLength !== null) {
            const tooBig = ctx.data.length > def.exactLength.value;
            const tooSmall = ctx.data.length < def.exactLength.value;
            if (tooBig || tooSmall) {
              addIssueToContext(ctx, {
                code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
                minimum: tooSmall ? def.exactLength.value : void 0,
                maximum: tooBig ? def.exactLength.value : void 0,
                type: "array",
                inclusive: true,
                exact: true,
                message: def.exactLength.message
              });
              status.dirty();
            }
          }
          if (def.minLength !== null) {
            if (ctx.data.length < def.minLength.value) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: def.minLength.value,
                type: "array",
                inclusive: true,
                exact: false,
                message: def.minLength.message
              });
              status.dirty();
            }
          }
          if (def.maxLength !== null) {
            if (ctx.data.length > def.maxLength.value) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: def.maxLength.value,
                type: "array",
                inclusive: true,
                exact: false,
                message: def.maxLength.message
              });
              status.dirty();
            }
          }
          if (ctx.common.async) {
            return Promise.all([...ctx.data].map((item, i) => {
              return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
            })).then((result2) => {
              return ParseStatus.mergeArray(status, result2);
            });
          }
          const result = [...ctx.data].map((item, i) => {
            return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
          });
          return ParseStatus.mergeArray(status, result);
        }
        get element() {
          return this._def.type;
        }
        min(minLength, message) {
          return new _ZodArray({
            ...this._def,
            minLength: { value: minLength, message: errorUtil.toString(message) }
          });
        }
        max(maxLength, message) {
          return new _ZodArray({
            ...this._def,
            maxLength: { value: maxLength, message: errorUtil.toString(message) }
          });
        }
        length(len, message) {
          return new _ZodArray({
            ...this._def,
            exactLength: { value: len, message: errorUtil.toString(message) }
          });
        }
        nonempty(message) {
          return this.min(1, message);
        }
      };
      ZodArray.create = (schema, params) => {
        return new ZodArray({
          type: schema,
          minLength: null,
          maxLength: null,
          exactLength: null,
          typeName: ZodFirstPartyTypeKind.ZodArray,
          ...processCreateParams(params)
        });
      };
      ZodObject = class _ZodObject extends ZodType {
        constructor() {
          super(...arguments);
          this._cached = null;
          this.nonstrict = this.passthrough;
          this.augment = this.extend;
        }
        _getCached() {
          if (this._cached !== null)
            return this._cached;
          const shape = this._def.shape();
          const keys = util.objectKeys(shape);
          return this._cached = { shape, keys };
        }
        _parse(input) {
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.object) {
            const ctx2 = this._getOrReturnCtx(input);
            addIssueToContext(ctx2, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.object,
              received: ctx2.parsedType
            });
            return INVALID;
          }
          const { status, ctx } = this._processInputParams(input);
          const { shape, keys: shapeKeys } = this._getCached();
          const extraKeys = [];
          if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
            for (const key in ctx.data) {
              if (!shapeKeys.includes(key)) {
                extraKeys.push(key);
              }
            }
          }
          const pairs = [];
          for (const key of shapeKeys) {
            const keyValidator = shape[key];
            const value = ctx.data[key];
            pairs.push({
              key: { status: "valid", value: key },
              value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
              alwaysSet: key in ctx.data
            });
          }
          if (this._def.catchall instanceof ZodNever) {
            const unknownKeys = this._def.unknownKeys;
            if (unknownKeys === "passthrough") {
              for (const key of extraKeys) {
                pairs.push({
                  key: { status: "valid", value: key },
                  value: { status: "valid", value: ctx.data[key] }
                });
              }
            } else if (unknownKeys === "strict") {
              if (extraKeys.length > 0) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.unrecognized_keys,
                  keys: extraKeys
                });
                status.dirty();
              }
            } else if (unknownKeys === "strip") ;
            else {
              throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
            }
          } else {
            const catchall = this._def.catchall;
            for (const key of extraKeys) {
              const value = ctx.data[key];
              pairs.push({
                key: { status: "valid", value: key },
                value: catchall._parse(
                  new ParseInputLazyPath(ctx, value, ctx.path, key)
                  //, ctx.child(key), value, getParsedType(value)
                ),
                alwaysSet: key in ctx.data
              });
            }
          }
          if (ctx.common.async) {
            return Promise.resolve().then(async () => {
              const syncPairs = [];
              for (const pair of pairs) {
                const key = await pair.key;
                const value = await pair.value;
                syncPairs.push({
                  key,
                  value,
                  alwaysSet: pair.alwaysSet
                });
              }
              return syncPairs;
            }).then((syncPairs) => {
              return ParseStatus.mergeObjectSync(status, syncPairs);
            });
          } else {
            return ParseStatus.mergeObjectSync(status, pairs);
          }
        }
        get shape() {
          return this._def.shape();
        }
        strict(message) {
          errorUtil.errToObj;
          return new _ZodObject({
            ...this._def,
            unknownKeys: "strict",
            ...message !== void 0 ? {
              errorMap: (issue, ctx) => {
                var _a, _b, _c, _d;
                const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
                if (issue.code === "unrecognized_keys")
                  return {
                    message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
                  };
                return {
                  message: defaultError
                };
              }
            } : {}
          });
        }
        strip() {
          return new _ZodObject({
            ...this._def,
            unknownKeys: "strip"
          });
        }
        passthrough() {
          return new _ZodObject({
            ...this._def,
            unknownKeys: "passthrough"
          });
        }
        // const AugmentFactory =
        //   <Def extends ZodObjectDef>(def: Def) =>
        //   <Augmentation extends ZodRawShape>(
        //     augmentation: Augmentation
        //   ): ZodObject<
        //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
        //     Def["unknownKeys"],
        //     Def["catchall"]
        //   > => {
        //     return new ZodObject({
        //       ...def,
        //       shape: () => ({
        //         ...def.shape(),
        //         ...augmentation,
        //       }),
        //     }) as any;
        //   };
        extend(augmentation) {
          return new _ZodObject({
            ...this._def,
            shape: () => ({
              ...this._def.shape(),
              ...augmentation
            })
          });
        }
        /**
         * Prior to zod@1.0.12 there was a bug in the
         * inferred type of merged objects. Please
         * upgrade if you are experiencing issues.
         */
        merge(merging) {
          const merged = new _ZodObject({
            unknownKeys: merging._def.unknownKeys,
            catchall: merging._def.catchall,
            shape: () => ({
              ...this._def.shape(),
              ...merging._def.shape()
            }),
            typeName: ZodFirstPartyTypeKind.ZodObject
          });
          return merged;
        }
        // merge<
        //   Incoming extends AnyZodObject,
        //   Augmentation extends Incoming["shape"],
        //   NewOutput extends {
        //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
        //       ? Augmentation[k]["_output"]
        //       : k extends keyof Output
        //       ? Output[k]
        //       : never;
        //   },
        //   NewInput extends {
        //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
        //       ? Augmentation[k]["_input"]
        //       : k extends keyof Input
        //       ? Input[k]
        //       : never;
        //   }
        // >(
        //   merging: Incoming
        // ): ZodObject<
        //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
        //   Incoming["_def"]["unknownKeys"],
        //   Incoming["_def"]["catchall"],
        //   NewOutput,
        //   NewInput
        // > {
        //   const merged: any = new ZodObject({
        //     unknownKeys: merging._def.unknownKeys,
        //     catchall: merging._def.catchall,
        //     shape: () =>
        //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
        //     typeName: ZodFirstPartyTypeKind.ZodObject,
        //   }) as any;
        //   return merged;
        // }
        setKey(key, schema) {
          return this.augment({ [key]: schema });
        }
        // merge<Incoming extends AnyZodObject>(
        //   merging: Incoming
        // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
        // ZodObject<
        //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
        //   Incoming["_def"]["unknownKeys"],
        //   Incoming["_def"]["catchall"]
        // > {
        //   // const mergedShape = objectUtil.mergeShapes(
        //   //   this._def.shape(),
        //   //   merging._def.shape()
        //   // );
        //   const merged: any = new ZodObject({
        //     unknownKeys: merging._def.unknownKeys,
        //     catchall: merging._def.catchall,
        //     shape: () =>
        //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
        //     typeName: ZodFirstPartyTypeKind.ZodObject,
        //   }) as any;
        //   return merged;
        // }
        catchall(index) {
          return new _ZodObject({
            ...this._def,
            catchall: index
          });
        }
        pick(mask) {
          const shape = {};
          util.objectKeys(mask).forEach((key) => {
            if (mask[key] && this.shape[key]) {
              shape[key] = this.shape[key];
            }
          });
          return new _ZodObject({
            ...this._def,
            shape: () => shape
          });
        }
        omit(mask) {
          const shape = {};
          util.objectKeys(this.shape).forEach((key) => {
            if (!mask[key]) {
              shape[key] = this.shape[key];
            }
          });
          return new _ZodObject({
            ...this._def,
            shape: () => shape
          });
        }
        /**
         * @deprecated
         */
        deepPartial() {
          return deepPartialify(this);
        }
        partial(mask) {
          const newShape = {};
          util.objectKeys(this.shape).forEach((key) => {
            const fieldSchema = this.shape[key];
            if (mask && !mask[key]) {
              newShape[key] = fieldSchema;
            } else {
              newShape[key] = fieldSchema.optional();
            }
          });
          return new _ZodObject({
            ...this._def,
            shape: () => newShape
          });
        }
        required(mask) {
          const newShape = {};
          util.objectKeys(this.shape).forEach((key) => {
            if (mask && !mask[key]) {
              newShape[key] = this.shape[key];
            } else {
              const fieldSchema = this.shape[key];
              let newField = fieldSchema;
              while (newField instanceof ZodOptional) {
                newField = newField._def.innerType;
              }
              newShape[key] = newField;
            }
          });
          return new _ZodObject({
            ...this._def,
            shape: () => newShape
          });
        }
        keyof() {
          return createZodEnum(util.objectKeys(this.shape));
        }
      };
      ZodObject.create = (shape, params) => {
        return new ZodObject({
          shape: () => shape,
          unknownKeys: "strip",
          catchall: ZodNever.create(),
          typeName: ZodFirstPartyTypeKind.ZodObject,
          ...processCreateParams(params)
        });
      };
      ZodObject.strictCreate = (shape, params) => {
        return new ZodObject({
          shape: () => shape,
          unknownKeys: "strict",
          catchall: ZodNever.create(),
          typeName: ZodFirstPartyTypeKind.ZodObject,
          ...processCreateParams(params)
        });
      };
      ZodObject.lazycreate = (shape, params) => {
        return new ZodObject({
          shape,
          unknownKeys: "strip",
          catchall: ZodNever.create(),
          typeName: ZodFirstPartyTypeKind.ZodObject,
          ...processCreateParams(params)
        });
      };
      ZodUnion = class extends ZodType {
        _parse(input) {
          const { ctx } = this._processInputParams(input);
          const options = this._def.options;
          function handleResults(results) {
            for (const result of results) {
              if (result.result.status === "valid") {
                return result.result;
              }
            }
            for (const result of results) {
              if (result.result.status === "dirty") {
                ctx.common.issues.push(...result.ctx.common.issues);
                return result.result;
              }
            }
            const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_union,
              unionErrors
            });
            return INVALID;
          }
          if (ctx.common.async) {
            return Promise.all(options.map(async (option) => {
              const childCtx = {
                ...ctx,
                common: {
                  ...ctx.common,
                  issues: []
                },
                parent: null
              };
              return {
                result: await option._parseAsync({
                  data: ctx.data,
                  path: ctx.path,
                  parent: childCtx
                }),
                ctx: childCtx
              };
            })).then(handleResults);
          } else {
            let dirty = void 0;
            const issues = [];
            for (const option of options) {
              const childCtx = {
                ...ctx,
                common: {
                  ...ctx.common,
                  issues: []
                },
                parent: null
              };
              const result = option._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: childCtx
              });
              if (result.status === "valid") {
                return result;
              } else if (result.status === "dirty" && !dirty) {
                dirty = { result, ctx: childCtx };
              }
              if (childCtx.common.issues.length) {
                issues.push(childCtx.common.issues);
              }
            }
            if (dirty) {
              ctx.common.issues.push(...dirty.ctx.common.issues);
              return dirty.result;
            }
            const unionErrors = issues.map((issues2) => new ZodError(issues2));
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_union,
              unionErrors
            });
            return INVALID;
          }
        }
        get options() {
          return this._def.options;
        }
      };
      ZodUnion.create = (types, params) => {
        return new ZodUnion({
          options: types,
          typeName: ZodFirstPartyTypeKind.ZodUnion,
          ...processCreateParams(params)
        });
      };
      getDiscriminator = (type) => {
        if (type instanceof ZodLazy) {
          return getDiscriminator(type.schema);
        } else if (type instanceof ZodEffects) {
          return getDiscriminator(type.innerType());
        } else if (type instanceof ZodLiteral) {
          return [type.value];
        } else if (type instanceof ZodEnum) {
          return type.options;
        } else if (type instanceof ZodNativeEnum) {
          return util.objectValues(type.enum);
        } else if (type instanceof ZodDefault) {
          return getDiscriminator(type._def.innerType);
        } else if (type instanceof ZodUndefined) {
          return [void 0];
        } else if (type instanceof ZodNull) {
          return [null];
        } else if (type instanceof ZodOptional) {
          return [void 0, ...getDiscriminator(type.unwrap())];
        } else if (type instanceof ZodNullable) {
          return [null, ...getDiscriminator(type.unwrap())];
        } else if (type instanceof ZodBranded) {
          return getDiscriminator(type.unwrap());
        } else if (type instanceof ZodReadonly) {
          return getDiscriminator(type.unwrap());
        } else if (type instanceof ZodCatch) {
          return getDiscriminator(type._def.innerType);
        } else {
          return [];
        }
      };
      ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
        _parse(input) {
          const { ctx } = this._processInputParams(input);
          if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.object,
              received: ctx.parsedType
            });
            return INVALID;
          }
          const discriminator = this.discriminator;
          const discriminatorValue = ctx.data[discriminator];
          const option = this.optionsMap.get(discriminatorValue);
          if (!option) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_union_discriminator,
              options: Array.from(this.optionsMap.keys()),
              path: [discriminator]
            });
            return INVALID;
          }
          if (ctx.common.async) {
            return option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
          } else {
            return option._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
          }
        }
        get discriminator() {
          return this._def.discriminator;
        }
        get options() {
          return this._def.options;
        }
        get optionsMap() {
          return this._def.optionsMap;
        }
        /**
         * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
         * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
         * have a different value for each object in the union.
         * @param discriminator the name of the discriminator property
         * @param types an array of object schemas
         * @param params
         */
        static create(discriminator, options, params) {
          const optionsMap = /* @__PURE__ */ new Map();
          for (const type of options) {
            const discriminatorValues = getDiscriminator(type.shape[discriminator]);
            if (!discriminatorValues.length) {
              throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
            }
            for (const value of discriminatorValues) {
              if (optionsMap.has(value)) {
                throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
              }
              optionsMap.set(value, type);
            }
          }
          return new _ZodDiscriminatedUnion({
            typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
            discriminator,
            options,
            optionsMap,
            ...processCreateParams(params)
          });
        }
      };
      ZodIntersection = class extends ZodType {
        _parse(input) {
          const { status, ctx } = this._processInputParams(input);
          const handleParsed = (parsedLeft, parsedRight) => {
            if (isAborted(parsedLeft) || isAborted(parsedRight)) {
              return INVALID;
            }
            const merged = mergeValues(parsedLeft.value, parsedRight.value);
            if (!merged.valid) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_intersection_types
              });
              return INVALID;
            }
            if (isDirty(parsedLeft) || isDirty(parsedRight)) {
              status.dirty();
            }
            return { status: status.value, value: merged.data };
          };
          if (ctx.common.async) {
            return Promise.all([
              this._def.left._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
              }),
              this._def.right._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
              })
            ]).then(([left, right]) => handleParsed(left, right));
          } else {
            return handleParsed(this._def.left._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            }), this._def.right._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            }));
          }
        }
      };
      ZodIntersection.create = (left, right, params) => {
        return new ZodIntersection({
          left,
          right,
          typeName: ZodFirstPartyTypeKind.ZodIntersection,
          ...processCreateParams(params)
        });
      };
      ZodTuple = class _ZodTuple extends ZodType {
        _parse(input) {
          const { status, ctx } = this._processInputParams(input);
          if (ctx.parsedType !== ZodParsedType.array) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.array,
              received: ctx.parsedType
            });
            return INVALID;
          }
          if (ctx.data.length < this._def.items.length) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: this._def.items.length,
              inclusive: true,
              exact: false,
              type: "array"
            });
            return INVALID;
          }
          const rest = this._def.rest;
          if (!rest && ctx.data.length > this._def.items.length) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: this._def.items.length,
              inclusive: true,
              exact: false,
              type: "array"
            });
            status.dirty();
          }
          const items = [...ctx.data].map((item, itemIndex) => {
            const schema = this._def.items[itemIndex] || this._def.rest;
            if (!schema)
              return null;
            return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
          }).filter((x) => !!x);
          if (ctx.common.async) {
            return Promise.all(items).then((results) => {
              return ParseStatus.mergeArray(status, results);
            });
          } else {
            return ParseStatus.mergeArray(status, items);
          }
        }
        get items() {
          return this._def.items;
        }
        rest(rest) {
          return new _ZodTuple({
            ...this._def,
            rest
          });
        }
      };
      ZodTuple.create = (schemas, params) => {
        if (!Array.isArray(schemas)) {
          throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
        }
        return new ZodTuple({
          items: schemas,
          typeName: ZodFirstPartyTypeKind.ZodTuple,
          rest: null,
          ...processCreateParams(params)
        });
      };
      ZodRecord = class _ZodRecord extends ZodType {
        get keySchema() {
          return this._def.keyType;
        }
        get valueSchema() {
          return this._def.valueType;
        }
        _parse(input) {
          const { status, ctx } = this._processInputParams(input);
          if (ctx.parsedType !== ZodParsedType.object) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.object,
              received: ctx.parsedType
            });
            return INVALID;
          }
          const pairs = [];
          const keyType = this._def.keyType;
          const valueType = this._def.valueType;
          for (const key in ctx.data) {
            pairs.push({
              key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
              value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
              alwaysSet: key in ctx.data
            });
          }
          if (ctx.common.async) {
            return ParseStatus.mergeObjectAsync(status, pairs);
          } else {
            return ParseStatus.mergeObjectSync(status, pairs);
          }
        }
        get element() {
          return this._def.valueType;
        }
        static create(first, second, third) {
          if (second instanceof ZodType) {
            return new _ZodRecord({
              keyType: first,
              valueType: second,
              typeName: ZodFirstPartyTypeKind.ZodRecord,
              ...processCreateParams(third)
            });
          }
          return new _ZodRecord({
            keyType: ZodString.create(),
            valueType: first,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(second)
          });
        }
      };
      ZodMap = class extends ZodType {
        get keySchema() {
          return this._def.keyType;
        }
        get valueSchema() {
          return this._def.valueType;
        }
        _parse(input) {
          const { status, ctx } = this._processInputParams(input);
          if (ctx.parsedType !== ZodParsedType.map) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.map,
              received: ctx.parsedType
            });
            return INVALID;
          }
          const keyType = this._def.keyType;
          const valueType = this._def.valueType;
          const pairs = [...ctx.data.entries()].map(([key, value], index) => {
            return {
              key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
              value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
            };
          });
          if (ctx.common.async) {
            const finalMap = /* @__PURE__ */ new Map();
            return Promise.resolve().then(async () => {
              for (const pair of pairs) {
                const key = await pair.key;
                const value = await pair.value;
                if (key.status === "aborted" || value.status === "aborted") {
                  return INVALID;
                }
                if (key.status === "dirty" || value.status === "dirty") {
                  status.dirty();
                }
                finalMap.set(key.value, value.value);
              }
              return { status: status.value, value: finalMap };
            });
          } else {
            const finalMap = /* @__PURE__ */ new Map();
            for (const pair of pairs) {
              const key = pair.key;
              const value = pair.value;
              if (key.status === "aborted" || value.status === "aborted") {
                return INVALID;
              }
              if (key.status === "dirty" || value.status === "dirty") {
                status.dirty();
              }
              finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
          }
        }
      };
      ZodMap.create = (keyType, valueType, params) => {
        return new ZodMap({
          valueType,
          keyType,
          typeName: ZodFirstPartyTypeKind.ZodMap,
          ...processCreateParams(params)
        });
      };
      ZodSet = class _ZodSet extends ZodType {
        _parse(input) {
          const { status, ctx } = this._processInputParams(input);
          if (ctx.parsedType !== ZodParsedType.set) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.set,
              received: ctx.parsedType
            });
            return INVALID;
          }
          const def = this._def;
          if (def.minSize !== null) {
            if (ctx.data.size < def.minSize.value) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: def.minSize.value,
                type: "set",
                inclusive: true,
                exact: false,
                message: def.minSize.message
              });
              status.dirty();
            }
          }
          if (def.maxSize !== null) {
            if (ctx.data.size > def.maxSize.value) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: def.maxSize.value,
                type: "set",
                inclusive: true,
                exact: false,
                message: def.maxSize.message
              });
              status.dirty();
            }
          }
          const valueType = this._def.valueType;
          function finalizeSet(elements2) {
            const parsedSet = /* @__PURE__ */ new Set();
            for (const element2 of elements2) {
              if (element2.status === "aborted")
                return INVALID;
              if (element2.status === "dirty")
                status.dirty();
              parsedSet.add(element2.value);
            }
            return { status: status.value, value: parsedSet };
          }
          const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
          if (ctx.common.async) {
            return Promise.all(elements).then((elements2) => finalizeSet(elements2));
          } else {
            return finalizeSet(elements);
          }
        }
        min(minSize, message) {
          return new _ZodSet({
            ...this._def,
            minSize: { value: minSize, message: errorUtil.toString(message) }
          });
        }
        max(maxSize, message) {
          return new _ZodSet({
            ...this._def,
            maxSize: { value: maxSize, message: errorUtil.toString(message) }
          });
        }
        size(size, message) {
          return this.min(size, message).max(size, message);
        }
        nonempty(message) {
          return this.min(1, message);
        }
      };
      ZodSet.create = (valueType, params) => {
        return new ZodSet({
          valueType,
          minSize: null,
          maxSize: null,
          typeName: ZodFirstPartyTypeKind.ZodSet,
          ...processCreateParams(params)
        });
      };
      ZodFunction = class _ZodFunction extends ZodType {
        constructor() {
          super(...arguments);
          this.validate = this.implement;
        }
        _parse(input) {
          const { ctx } = this._processInputParams(input);
          if (ctx.parsedType !== ZodParsedType.function) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.function,
              received: ctx.parsedType
            });
            return INVALID;
          }
          function makeArgsIssue(args, error) {
            return makeIssue({
              data: args,
              path: ctx.path,
              errorMaps: [
                ctx.common.contextualErrorMap,
                ctx.schemaErrorMap,
                getErrorMap(),
                errorMap
              ].filter((x) => !!x),
              issueData: {
                code: ZodIssueCode.invalid_arguments,
                argumentsError: error
              }
            });
          }
          function makeReturnsIssue(returns, error) {
            return makeIssue({
              data: returns,
              path: ctx.path,
              errorMaps: [
                ctx.common.contextualErrorMap,
                ctx.schemaErrorMap,
                getErrorMap(),
                errorMap
              ].filter((x) => !!x),
              issueData: {
                code: ZodIssueCode.invalid_return_type,
                returnTypeError: error
              }
            });
          }
          const params = { errorMap: ctx.common.contextualErrorMap };
          const fn = ctx.data;
          if (this._def.returns instanceof ZodPromise) {
            const me = this;
            return OK(async function(...args) {
              const error = new ZodError([]);
              const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
                error.addIssue(makeArgsIssue(args, e));
                throw error;
              });
              const result = await Reflect.apply(fn, this, parsedArgs);
              const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
                error.addIssue(makeReturnsIssue(result, e));
                throw error;
              });
              return parsedReturns;
            });
          } else {
            const me = this;
            return OK(function(...args) {
              const parsedArgs = me._def.args.safeParse(args, params);
              if (!parsedArgs.success) {
                throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
              }
              const result = Reflect.apply(fn, this, parsedArgs.data);
              const parsedReturns = me._def.returns.safeParse(result, params);
              if (!parsedReturns.success) {
                throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
              }
              return parsedReturns.data;
            });
          }
        }
        parameters() {
          return this._def.args;
        }
        returnType() {
          return this._def.returns;
        }
        args(...items) {
          return new _ZodFunction({
            ...this._def,
            args: ZodTuple.create(items).rest(ZodUnknown.create())
          });
        }
        returns(returnType) {
          return new _ZodFunction({
            ...this._def,
            returns: returnType
          });
        }
        implement(func) {
          const validatedFunc = this.parse(func);
          return validatedFunc;
        }
        strictImplement(func) {
          const validatedFunc = this.parse(func);
          return validatedFunc;
        }
        static create(args, returns, params) {
          return new _ZodFunction({
            args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
            returns: returns || ZodUnknown.create(),
            typeName: ZodFirstPartyTypeKind.ZodFunction,
            ...processCreateParams(params)
          });
        }
      };
      ZodLazy = class extends ZodType {
        get schema() {
          return this._def.getter();
        }
        _parse(input) {
          const { ctx } = this._processInputParams(input);
          const lazySchema = this._def.getter();
          return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
        }
      };
      ZodLazy.create = (getter, params) => {
        return new ZodLazy({
          getter,
          typeName: ZodFirstPartyTypeKind.ZodLazy,
          ...processCreateParams(params)
        });
      };
      ZodLiteral = class extends ZodType {
        _parse(input) {
          if (input.data !== this._def.value) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
              received: ctx.data,
              code: ZodIssueCode.invalid_literal,
              expected: this._def.value
            });
            return INVALID;
          }
          return { status: "valid", value: input.data };
        }
        get value() {
          return this._def.value;
        }
      };
      ZodLiteral.create = (value, params) => {
        return new ZodLiteral({
          value,
          typeName: ZodFirstPartyTypeKind.ZodLiteral,
          ...processCreateParams(params)
        });
      };
      ZodEnum = class _ZodEnum extends ZodType {
        constructor() {
          super(...arguments);
          _ZodEnum_cache.set(this, void 0);
        }
        _parse(input) {
          if (typeof input.data !== "string") {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
              expected: util.joinValues(expectedValues),
              received: ctx.parsedType,
              code: ZodIssueCode.invalid_type
            });
            return INVALID;
          }
          if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f")) {
            __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values), "f");
          }
          if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f").has(input.data)) {
            const ctx = this._getOrReturnCtx(input);
            const expectedValues = this._def.values;
            addIssueToContext(ctx, {
              received: ctx.data,
              code: ZodIssueCode.invalid_enum_value,
              options: expectedValues
            });
            return INVALID;
          }
          return OK(input.data);
        }
        get options() {
          return this._def.values;
        }
        get enum() {
          const enumValues = {};
          for (const val of this._def.values) {
            enumValues[val] = val;
          }
          return enumValues;
        }
        get Values() {
          const enumValues = {};
          for (const val of this._def.values) {
            enumValues[val] = val;
          }
          return enumValues;
        }
        get Enum() {
          const enumValues = {};
          for (const val of this._def.values) {
            enumValues[val] = val;
          }
          return enumValues;
        }
        extract(values, newDef = this._def) {
          return _ZodEnum.create(values, {
            ...this._def,
            ...newDef
          });
        }
        exclude(values, newDef = this._def) {
          return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
            ...this._def,
            ...newDef
          });
        }
      };
      _ZodEnum_cache = /* @__PURE__ */ new WeakMap();
      ZodEnum.create = createZodEnum;
      ZodNativeEnum = class extends ZodType {
        constructor() {
          super(...arguments);
          _ZodNativeEnum_cache.set(this, void 0);
        }
        _parse(input) {
          const nativeEnumValues = util.getValidEnumValues(this._def.values);
          const ctx = this._getOrReturnCtx(input);
          if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
              expected: util.joinValues(expectedValues),
              received: ctx.parsedType,
              code: ZodIssueCode.invalid_type
            });
            return INVALID;
          }
          if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f")) {
            __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)), "f");
          }
          if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f").has(input.data)) {
            const expectedValues = util.objectValues(nativeEnumValues);
            addIssueToContext(ctx, {
              received: ctx.data,
              code: ZodIssueCode.invalid_enum_value,
              options: expectedValues
            });
            return INVALID;
          }
          return OK(input.data);
        }
        get enum() {
          return this._def.values;
        }
      };
      _ZodNativeEnum_cache = /* @__PURE__ */ new WeakMap();
      ZodNativeEnum.create = (values, params) => {
        return new ZodNativeEnum({
          values,
          typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
          ...processCreateParams(params)
        });
      };
      ZodPromise = class extends ZodType {
        unwrap() {
          return this._def.type;
        }
        _parse(input) {
          const { ctx } = this._processInputParams(input);
          if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.promise,
              received: ctx.parsedType
            });
            return INVALID;
          }
          const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
          return OK(promisified.then((data) => {
            return this._def.type.parseAsync(data, {
              path: ctx.path,
              errorMap: ctx.common.contextualErrorMap
            });
          }));
        }
      };
      ZodPromise.create = (schema, params) => {
        return new ZodPromise({
          type: schema,
          typeName: ZodFirstPartyTypeKind.ZodPromise,
          ...processCreateParams(params)
        });
      };
      ZodEffects = class extends ZodType {
        innerType() {
          return this._def.schema;
        }
        sourceType() {
          return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
        }
        _parse(input) {
          const { status, ctx } = this._processInputParams(input);
          const effect = this._def.effect || null;
          const checkCtx = {
            addIssue: (arg) => {
              addIssueToContext(ctx, arg);
              if (arg.fatal) {
                status.abort();
              } else {
                status.dirty();
              }
            },
            get path() {
              return ctx.path;
            }
          };
          checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
          if (effect.type === "preprocess") {
            const processed = effect.transform(ctx.data, checkCtx);
            if (ctx.common.async) {
              return Promise.resolve(processed).then(async (processed2) => {
                if (status.value === "aborted")
                  return INVALID;
                const result = await this._def.schema._parseAsync({
                  data: processed2,
                  path: ctx.path,
                  parent: ctx
                });
                if (result.status === "aborted")
                  return INVALID;
                if (result.status === "dirty")
                  return DIRTY(result.value);
                if (status.value === "dirty")
                  return DIRTY(result.value);
                return result;
              });
            } else {
              if (status.value === "aborted")
                return INVALID;
              const result = this._def.schema._parseSync({
                data: processed,
                path: ctx.path,
                parent: ctx
              });
              if (result.status === "aborted")
                return INVALID;
              if (result.status === "dirty")
                return DIRTY(result.value);
              if (status.value === "dirty")
                return DIRTY(result.value);
              return result;
            }
          }
          if (effect.type === "refinement") {
            const executeRefinement = (acc) => {
              const result = effect.refinement(acc, checkCtx);
              if (ctx.common.async) {
                return Promise.resolve(result);
              }
              if (result instanceof Promise) {
                throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
              }
              return acc;
            };
            if (ctx.common.async === false) {
              const inner = this._def.schema._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
              });
              if (inner.status === "aborted")
                return INVALID;
              if (inner.status === "dirty")
                status.dirty();
              executeRefinement(inner.value);
              return { status: status.value, value: inner.value };
            } else {
              return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
                if (inner.status === "aborted")
                  return INVALID;
                if (inner.status === "dirty")
                  status.dirty();
                return executeRefinement(inner.value).then(() => {
                  return { status: status.value, value: inner.value };
                });
              });
            }
          }
          if (effect.type === "transform") {
            if (ctx.common.async === false) {
              const base = this._def.schema._parseSync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
              });
              if (!isValid(base))
                return base;
              const result = effect.transform(base.value, checkCtx);
              if (result instanceof Promise) {
                throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
              }
              return { status: status.value, value: result };
            } else {
              return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
                if (!isValid(base))
                  return base;
                return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
              });
            }
          }
          util.assertNever(effect);
        }
      };
      ZodEffects.create = (schema, effect, params) => {
        return new ZodEffects({
          schema,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect,
          ...processCreateParams(params)
        });
      };
      ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
        return new ZodEffects({
          schema,
          effect: { type: "preprocess", transform: preprocess },
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          ...processCreateParams(params)
        });
      };
      ZodOptional = class extends ZodType {
        _parse(input) {
          const parsedType = this._getType(input);
          if (parsedType === ZodParsedType.undefined) {
            return OK(void 0);
          }
          return this._def.innerType._parse(input);
        }
        unwrap() {
          return this._def.innerType;
        }
      };
      ZodOptional.create = (type, params) => {
        return new ZodOptional({
          innerType: type,
          typeName: ZodFirstPartyTypeKind.ZodOptional,
          ...processCreateParams(params)
        });
      };
      ZodNullable = class extends ZodType {
        _parse(input) {
          const parsedType = this._getType(input);
          if (parsedType === ZodParsedType.null) {
            return OK(null);
          }
          return this._def.innerType._parse(input);
        }
        unwrap() {
          return this._def.innerType;
        }
      };
      ZodNullable.create = (type, params) => {
        return new ZodNullable({
          innerType: type,
          typeName: ZodFirstPartyTypeKind.ZodNullable,
          ...processCreateParams(params)
        });
      };
      ZodDefault = class extends ZodType {
        _parse(input) {
          const { ctx } = this._processInputParams(input);
          let data = ctx.data;
          if (ctx.parsedType === ZodParsedType.undefined) {
            data = this._def.defaultValue();
          }
          return this._def.innerType._parse({
            data,
            path: ctx.path,
            parent: ctx
          });
        }
        removeDefault() {
          return this._def.innerType;
        }
      };
      ZodDefault.create = (type, params) => {
        return new ZodDefault({
          innerType: type,
          typeName: ZodFirstPartyTypeKind.ZodDefault,
          defaultValue: typeof params.default === "function" ? params.default : () => params.default,
          ...processCreateParams(params)
        });
      };
      ZodCatch = class extends ZodType {
        _parse(input) {
          const { ctx } = this._processInputParams(input);
          const newCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            }
          };
          const result = this._def.innerType._parse({
            data: newCtx.data,
            path: newCtx.path,
            parent: {
              ...newCtx
            }
          });
          if (isAsync(result)) {
            return result.then((result2) => {
              return {
                status: "valid",
                value: result2.status === "valid" ? result2.value : this._def.catchValue({
                  get error() {
                    return new ZodError(newCtx.common.issues);
                  },
                  input: newCtx.data
                })
              };
            });
          } else {
            return {
              status: "valid",
              value: result.status === "valid" ? result.value : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data
              })
            };
          }
        }
        removeCatch() {
          return this._def.innerType;
        }
      };
      ZodCatch.create = (type, params) => {
        return new ZodCatch({
          innerType: type,
          typeName: ZodFirstPartyTypeKind.ZodCatch,
          catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
          ...processCreateParams(params)
        });
      };
      ZodNaN = class extends ZodType {
        _parse(input) {
          const parsedType = this._getType(input);
          if (parsedType !== ZodParsedType.nan) {
            const ctx = this._getOrReturnCtx(input);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: ZodParsedType.nan,
              received: ctx.parsedType
            });
            return INVALID;
          }
          return { status: "valid", value: input.data };
        }
      };
      ZodNaN.create = (params) => {
        return new ZodNaN({
          typeName: ZodFirstPartyTypeKind.ZodNaN,
          ...processCreateParams(params)
        });
      };
      BRAND = Symbol("zod_brand");
      ZodBranded = class extends ZodType {
        _parse(input) {
          const { ctx } = this._processInputParams(input);
          const data = ctx.data;
          return this._def.type._parse({
            data,
            path: ctx.path,
            parent: ctx
          });
        }
        unwrap() {
          return this._def.type;
        }
      };
      ZodPipeline = class _ZodPipeline extends ZodType {
        _parse(input) {
          const { status, ctx } = this._processInputParams(input);
          if (ctx.common.async) {
            const handleAsync = async () => {
              const inResult = await this._def.in._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: ctx
              });
              if (inResult.status === "aborted")
                return INVALID;
              if (inResult.status === "dirty") {
                status.dirty();
                return DIRTY(inResult.value);
              } else {
                return this._def.out._parseAsync({
                  data: inResult.value,
                  path: ctx.path,
                  parent: ctx
                });
              }
            };
            return handleAsync();
          } else {
            const inResult = this._def.in._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inResult.status === "aborted")
              return INVALID;
            if (inResult.status === "dirty") {
              status.dirty();
              return {
                status: "dirty",
                value: inResult.value
              };
            } else {
              return this._def.out._parseSync({
                data: inResult.value,
                path: ctx.path,
                parent: ctx
              });
            }
          }
        }
        static create(a, b) {
          return new _ZodPipeline({
            in: a,
            out: b,
            typeName: ZodFirstPartyTypeKind.ZodPipeline
          });
        }
      };
      ZodReadonly = class extends ZodType {
        _parse(input) {
          const result = this._def.innerType._parse(input);
          const freeze = (data) => {
            if (isValid(data)) {
              data.value = Object.freeze(data.value);
            }
            return data;
          };
          return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
        }
        unwrap() {
          return this._def.innerType;
        }
      };
      ZodReadonly.create = (type, params) => {
        return new ZodReadonly({
          innerType: type,
          typeName: ZodFirstPartyTypeKind.ZodReadonly,
          ...processCreateParams(params)
        });
      };
      late = {
        object: ZodObject.lazycreate
      };
      (function(ZodFirstPartyTypeKind2) {
        ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
        ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
        ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
        ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
        ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
        ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
        ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
        ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
        ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
        ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
        ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
        ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
        ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
        ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
        ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
        ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
        ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
        ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
        ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
        ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
        ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
        ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
        ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
        ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
        ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
        ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
        ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
        ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
        ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
        ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
        ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
        ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
        ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
        ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
        ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
        ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
      })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
      instanceOfType = (cls, params = {
        message: `Input not instance of ${cls.name}`
      }) => custom((data) => data instanceof cls, params);
      stringType = ZodString.create;
      numberType = ZodNumber.create;
      nanType = ZodNaN.create;
      bigIntType = ZodBigInt.create;
      booleanType = ZodBoolean.create;
      dateType = ZodDate.create;
      symbolType = ZodSymbol.create;
      undefinedType = ZodUndefined.create;
      nullType = ZodNull.create;
      anyType = ZodAny.create;
      unknownType = ZodUnknown.create;
      neverType = ZodNever.create;
      voidType = ZodVoid.create;
      arrayType = ZodArray.create;
      objectType = ZodObject.create;
      strictObjectType = ZodObject.strictCreate;
      unionType = ZodUnion.create;
      discriminatedUnionType = ZodDiscriminatedUnion.create;
      intersectionType = ZodIntersection.create;
      tupleType = ZodTuple.create;
      recordType = ZodRecord.create;
      mapType = ZodMap.create;
      setType = ZodSet.create;
      functionType = ZodFunction.create;
      lazyType = ZodLazy.create;
      literalType = ZodLiteral.create;
      enumType = ZodEnum.create;
      nativeEnumType = ZodNativeEnum.create;
      promiseType = ZodPromise.create;
      effectsType = ZodEffects.create;
      optionalType = ZodOptional.create;
      nullableType = ZodNullable.create;
      preprocessType = ZodEffects.createWithPreprocess;
      pipelineType = ZodPipeline.create;
      ostring = () => stringType().optional();
      onumber = () => numberType().optional();
      oboolean = () => booleanType().optional();
      coerce = {
        string: (arg) => ZodString.create({ ...arg, coerce: true }),
        number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
        boolean: (arg) => ZodBoolean.create({
          ...arg,
          coerce: true
        }),
        bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
        date: (arg) => ZodDate.create({ ...arg, coerce: true })
      };
      NEVER = INVALID;
      z = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        defaultErrorMap: errorMap,
        setErrorMap,
        getErrorMap,
        makeIssue,
        EMPTY_PATH,
        addIssueToContext,
        ParseStatus,
        INVALID,
        DIRTY,
        OK,
        isAborted,
        isDirty,
        isValid,
        isAsync,
        get util() {
          return util;
        },
        get objectUtil() {
          return objectUtil;
        },
        ZodParsedType,
        getParsedType,
        ZodType,
        datetimeRegex,
        ZodString,
        ZodNumber,
        ZodBigInt,
        ZodBoolean,
        ZodDate,
        ZodSymbol,
        ZodUndefined,
        ZodNull,
        ZodAny,
        ZodUnknown,
        ZodNever,
        ZodVoid,
        ZodArray,
        ZodObject,
        ZodUnion,
        ZodDiscriminatedUnion,
        ZodIntersection,
        ZodTuple,
        ZodRecord,
        ZodMap,
        ZodSet,
        ZodFunction,
        ZodLazy,
        ZodLiteral,
        ZodEnum,
        ZodNativeEnum,
        ZodPromise,
        ZodEffects,
        ZodTransformer: ZodEffects,
        ZodOptional,
        ZodNullable,
        ZodDefault,
        ZodCatch,
        ZodNaN,
        BRAND,
        ZodBranded,
        ZodPipeline,
        ZodReadonly,
        custom,
        Schema: ZodType,
        ZodSchema: ZodType,
        late,
        get ZodFirstPartyTypeKind() {
          return ZodFirstPartyTypeKind;
        },
        coerce,
        any: anyType,
        array: arrayType,
        bigint: bigIntType,
        boolean: booleanType,
        date: dateType,
        discriminatedUnion: discriminatedUnionType,
        effect: effectsType,
        "enum": enumType,
        "function": functionType,
        "instanceof": instanceOfType,
        intersection: intersectionType,
        lazy: lazyType,
        literal: literalType,
        map: mapType,
        nan: nanType,
        nativeEnum: nativeEnumType,
        never: neverType,
        "null": nullType,
        nullable: nullableType,
        number: numberType,
        object: objectType,
        oboolean,
        onumber,
        optional: optionalType,
        ostring,
        pipeline: pipelineType,
        preprocess: preprocessType,
        promise: promiseType,
        record: recordType,
        set: setType,
        strictObject: strictObjectType,
        string: stringType,
        symbol: symbolType,
        transformer: effectsType,
        tuple: tupleType,
        "undefined": undefinedType,
        union: unionType,
        unknown: unknownType,
        "void": voidType,
        NEVER,
        ZodIssueCode,
        quotelessJson,
        ZodError
      });
    }
  });

  // src/lib/amex-benefit-reader/contract.ts
  function approvedVisibleText(maxLength) {
    return z.string().trim().min(1).max(maxLength).refine(
      (value) => !POSSIBLE_FULL_CARD_NUMBER.test(value),
      "Visible text contains a disallowed long number."
    );
  }
  function observedFieldSchema(value) {
    return z.discriminatedUnion("state", [
      z.object({ state: z.literal("observed"), value }).strict(),
      z.object({ state: z.literal("not_exposed") }).strict(),
      z.object({ state: z.literal("unrecognized"), issueCode: issueCodeSchema }).strict()
    ]);
  }
  function isRealDateOnly(value) {
    if (!DATE_ONLY.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  function requireUniqueBenefitKeys(observation, context) {
    const keys = /* @__PURE__ */ new Set();
    observation.benefits.forEach((benefit, index) => {
      if (keys.has(benefit.benefitKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["benefits", index, "benefitKey"],
          message: "Benefit keys must be unique within a card observation."
        });
      }
      keys.add(benefit.benefitKey);
    });
  }
  function assertNoForbiddenFieldNames(value) {
    const visit = (candidate) => {
      if (Array.isArray(candidate)) {
        candidate.forEach(visit);
        return;
      }
      if (!candidate || typeof candidate !== "object") return;
      for (const [key, child] of Object.entries(candidate)) {
        if (FORBIDDEN_FIELD_PATTERN.test(key.replace(/[^a-z]/gi, ""))) {
          throw new Error("Storage contains a forbidden field name.");
        }
        visit(child);
      }
    };
    visit(value);
  }
  function parseStoreEnvelope(value) {
    assertNoForbiddenFieldNames(value);
    return storeEnvelopeSchema.parse(value);
  }
  var OBSERVATION_CONTRACT_VERSION, OBSERVATION_CONTRACT_VERSION_V2, OBSERVATION_CONTRACT_VERSION_V3, STORAGE_SCHEMA_VERSION, PARSER_VERSION, issueCodeSchema, quantitySchema, POSSIBLE_FULL_CARD_NUMBER, activityKindSchema, benefitObservationFields, normalizedBenefitObservationSchema, DATE_ONLY, utcDateOnlySchema, sourcePeriodV2Schema, amexProductKeySchema, creditFamilyKeySchema, normalizedBenefitObservationV2Schema, normalizedBenefitObservationV3Schema, cardObservationFields, normalizedCardObservationSchema, normalizedCardObservationV2Schema, normalizedCardObservationV3Schema, normalizedCardObservationAnySchema, redactedErrorSchema, storedCardRecordSchema, scanCardDispositionSchema, scanSummarySchema, storeEnvelopeSchema, FORBIDDEN_FIELD_PATTERN;
  var init_contract = __esm({
    "src/lib/amex-benefit-reader/contract.ts"() {
      "use strict";
      init_lib();
      OBSERVATION_CONTRACT_VERSION = "amex-benefits/1";
      OBSERVATION_CONTRACT_VERSION_V2 = "amex-benefits/2";
      OBSERVATION_CONTRACT_VERSION_V3 = "amex-benefits/3";
      STORAGE_SCHEMA_VERSION = 1;
      PARSER_VERSION = "amex-api-us/3.0.0";
      issueCodeSchema = z.enum([
        "unknown_account_variant",
        "duplicate_card_entry",
        "identity_unavailable",
        "identity_ambiguous",
        "identity_conflict",
        "display_reconciled",
        "response_schema_invalid",
        "unknown_activity_kind",
        "unknown_status",
        "unknown_quantity",
        "benefit_identity_conflict",
        "request_timeout",
        "network_error",
        "http_error",
        "content_type_invalid",
        "redirect_rejected",
        "signed_out",
        "scan_cancelled",
        "visible_context_changed",
        "storage_invalid"
      ]);
      quantitySchema = z.object({
        value: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/),
        unit: z.enum(["USD", "count", "points", "percent", "unknown"]),
        currency: z.literal("USD").nullable()
      }).strict().superRefine((quantity, context) => {
        if (quantity.unit === "USD" !== (quantity.currency === "USD")) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["currency"], message: "Currency must match the quantity unit." });
        }
      });
      POSSIBLE_FULL_CARD_NUMBER = /(?:\d[ -]?){11,18}\d/;
      activityKindSchema = z.enum([
        "enrollment_candidate",
        "spend_progress",
        "credit_usage",
        "credit_earned",
        "completed"
      ]);
      benefitObservationFields = {
        benefitKey: z.string().min(16).max(128),
        title: approvedVisibleText(200),
        category: observedFieldSchema(approvedVisibleText(100)),
        activityKind: activityKindSchema,
        enrollmentState: observedFieldSchema(z.enum([
          "enrolled",
          "required",
          "linking_required",
          "not_required"
        ])),
        trackerState: observedFieldSchema(z.enum([
          "not_started",
          "in_progress",
          "earned",
          "completed"
        ])),
        completionState: observedFieldSchema(z.enum(["complete", "incomplete"])),
        earnedOrUsed: observedFieldSchema(quantitySchema),
        targetOrLimit: observedFieldSchema(quantitySchema),
        remaining: observedFieldSchema(quantitySchema),
        period: observedFieldSchema(approvedVisibleText(160)),
        confidence: z.enum(["high", "medium", "low"]),
        issueCodes: z.array(issueCodeSchema).max(20)
      };
      normalizedBenefitObservationSchema = z.object(benefitObservationFields).strict();
      DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
      utcDateOnlySchema = z.string().refine(isRealDateOnly, "Expected a real UTC calendar date in YYYY-MM-DD form.");
      sourcePeriodV2Schema = z.object({
        kind: z.literal("calendar_date_range"),
        startDate: utcDateOnlySchema,
        endDate: utcDateOnlySchema,
        timeZone: z.literal("UTC")
      }).strict().superRefine((period, context) => {
        if (period.startDate > period.endDate) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "The period end must not precede its start." });
        }
      });
      amexProductKeySchema = z.enum([
        "american-express-gold-card",
        "american-express-platinum-card",
        "american-express-business-platinum-card",
        "american-express-business-gold-card",
        "hilton-honors-american-express-aspire-card",
        "hilton-honors-american-express-surpass-card",
        "hilton-honors-american-express-business-card",
        "delta-skymiles-gold-american-express-card",
        "delta-skymiles-platinum-american-express-card",
        "delta-skymiles-reserve-american-express-card",
        "marriott-bonvoy-brilliant-american-express-card",
        "marriott-bonvoy-business-american-express-card"
      ]);
      creditFamilyKeySchema = z.string().min(8).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)$/);
      normalizedBenefitObservationV2Schema = z.object({
        ...benefitObservationFields,
        creditFamilyKey: creditFamilyKeySchema,
        sourcePeriod: observedFieldSchema(sourcePeriodV2Schema)
      }).strict();
      normalizedBenefitObservationV3Schema = z.object({
        ...benefitObservationFields,
        sourcePeriod: observedFieldSchema(sourcePeriodV2Schema)
      }).strict();
      cardObservationFields = {
        issuer: z.literal("american_express_us"),
        localCardId: z.string().uuid(),
        productName: approvedVisibleText(160),
        endingDigits: z.string().regex(/^\d{4,5}$/),
        observedAt: z.string().datetime({ offset: true }),
        parserVersion: z.string().min(1).max(80),
        completeness: z.enum(["complete", "partial"]),
        issueCodes: z.array(issueCodeSchema).max(30)
      };
      normalizedCardObservationSchema = z.object({
        contractVersion: z.literal(OBSERVATION_CONTRACT_VERSION),
        ...cardObservationFields,
        benefits: z.array(normalizedBenefitObservationSchema).max(300)
      }).strict().superRefine(requireUniqueBenefitKeys);
      normalizedCardObservationV2Schema = z.object({
        contractVersion: z.literal(OBSERVATION_CONTRACT_VERSION_V2),
        ...cardObservationFields,
        scanId: z.string().uuid(),
        productKey: amexProductKeySchema,
        benefits: z.array(normalizedBenefitObservationV2Schema).max(300)
      }).strict().superRefine(requireUniqueBenefitKeys);
      normalizedCardObservationV3Schema = z.object({
        contractVersion: z.literal(OBSERVATION_CONTRACT_VERSION_V3),
        ...cardObservationFields,
        scanId: z.string().uuid(),
        benefits: z.array(normalizedBenefitObservationV3Schema).max(300)
      }).strict().superRefine(requireUniqueBenefitKeys);
      normalizedCardObservationAnySchema = z.union([
        normalizedCardObservationSchema,
        normalizedCardObservationV2Schema,
        normalizedCardObservationV3Schema
      ]);
      redactedErrorSchema = z.object({
        code: issueCodeSchema,
        message: z.string().min(1).max(240)
      }).strict();
      storedCardRecordSchema = z.object({
        localCardId: z.string().uuid(),
        identity: z.object({
          sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
          productName: approvedVisibleText(160),
          endingDigits: z.string().regex(/^\d{4,5}$/)
        }).strict(),
        latest: normalizedCardObservationAnySchema.nullable(),
        freshness: z.enum(["current", "stale_error", "error_no_data"]),
        completeness: z.enum(["complete", "partial", "failed"]),
        observedAt: z.string().datetime({ offset: true }).nullable(),
        lastAttemptAt: z.string().datetime({ offset: true }),
        error: redactedErrorSchema.nullable()
      }).strict().superRefine((record, context) => {
        if (record.latest) {
          const consistent = record.latest.localCardId === record.localCardId && record.latest.productName === record.identity.productName && record.latest.endingDigits === record.identity.endingDigits && record.latest.observedAt === record.observedAt;
          if (!consistent) context.addIssue({ code: z.ZodIssueCode.custom, message: "Stored card identity and observation are inconsistent." });
        } else if (record.observedAt !== null) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["observedAt"], message: "A card without an observation cannot have an observation time." });
        }
        const validState = record.freshness === "current" ? Boolean(record.latest && !record.error && record.completeness === record.latest.completeness) : record.freshness === "stale_error" ? Boolean(record.latest && record.error && record.completeness === "failed") : Boolean(!record.latest && record.error && record.completeness === "failed");
        if (!validState) context.addIssue({ code: z.ZodIssueCode.custom, message: "Stored card freshness, completeness, data, and error state are inconsistent." });
      });
      scanCardDispositionSchema = z.object({
        localCardId: z.string().uuid().nullable(),
        result: z.enum(["complete", "partial", "failed"]),
        issueCode: issueCodeSchema.nullable()
      }).strict();
      scanSummarySchema = z.object({
        scanId: z.string().uuid().optional(),
        startedAt: z.string().datetime({ offset: true }),
        finishedAt: z.string().datetime({ offset: true }),
        status: z.enum(["complete", "partial", "interrupted", "failed"]),
        discoveredCardCount: z.number().int().nonnegative(),
        attemptedCardCount: z.number().int().nonnegative(),
        unknownAccountVariantCount: z.number().int().nonnegative(),
        cards: z.array(scanCardDispositionSchema).max(300),
        visibleContext: z.enum(["unchanged", "changed", "unavailable"])
      }).strict();
      storeEnvelopeSchema = z.object({
        schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
        revision: z.number().int().nonnegative(),
        updatedAt: z.string().datetime({ offset: true }),
        cards: z.record(z.string().uuid(), storedCardRecordSchema),
        lastScan: scanSummarySchema.nullable()
      }).strict().superRefine((store, context) => {
        Object.entries(store.cards).forEach(([key, record]) => {
          if (key !== record.localCardId) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["cards", key, "localCardId"],
              message: "Stored card keys must match their local card IDs."
            });
          }
        });
      });
      FORBIDDEN_FIELD_PATTERN = /(?:fullcard|cardnumber|accountnumber|accounttoken|opaquetoken|tokenvalue|pan|cvv|cvc|password|passcode|mfa|cookie|authorization|authheader|requestheaders|requestbody|rawdom|rawhtml|rawjson|rawrequest|rawresponse|loyaltynumber|balance|transaction)/i;
    }
  });

  // src/lib/amex-catalog/catalog-registry.ts
  var usage, excluded, AMEX_CATALOG_IDENTITY_REGISTRY, AMEX_WRITABLE_DESTINATIONS;
  var init_catalog_registry = __esm({
    "src/lib/amex-catalog/catalog-registry.ts"() {
      "use strict";
      usage = (catalogKey, parentCatalogKey, family, periodKey, sourceCreditKey = family) => ({
        catalogKey,
        parentCatalogKey,
        creditFamilyKey: family,
        periodKey,
        sourceSemantics: "usage",
        sourceCreditKey
      });
      excluded = (catalogKey, parentCatalogKey, family, periodKey, sourceSemantics) => ({
        catalogKey,
        parentCatalogKey,
        creditFamilyKey: family,
        periodKey,
        sourceSemantics,
        sourceCreditKey: null
      });
      AMEX_CATALOG_IDENTITY_REGISTRY = {
        "American Express Gold Card": {
          catalogKey: "card:american-express-gold-card",
          productKey: "american-express-gold-card",
          exactAliases: ["American Express Gold Card", "American Express Gold Card®", "Amex Gold Card"],
          benefits: [
            usage("benefit:american-express-gold-card:uber-cash:calendar-month", "card:american-express-gold-card", "american-express-gold-card:uber-cash", "calendar-month"),
            usage("benefit:american-express-gold-card:dining:calendar-month", "card:american-express-gold-card", "american-express-gold-card:dining", "calendar-month"),
            usage("benefit:american-express-gold-card:dunkin:calendar-month", "card:american-express-gold-card", "american-express-gold-card:dunkin", "calendar-month"),
            usage("benefit:american-express-gold-card:resy:calendar-half-h1", "card:american-express-gold-card", "american-express-gold-card:resy", "calendar-half-h1"),
            usage("benefit:american-express-gold-card:resy:calendar-half-h2", "card:american-express-gold-card", "american-express-gold-card:resy", "calendar-half-h2")
          ]
        },
        "American Express Platinum Card": {
          catalogKey: "card:american-express-platinum-card",
          productKey: "american-express-platinum-card",
          exactAliases: ["American Express Platinum Card", "The Platinum Card from American Express", "Platinum Card®"],
          affiliationAliases: ["Morgan Stanley Platinum", "The Platinum Card from American Express Exclusively for Morgan Stanley"],
          benefits: [
            usage("benefit:american-express-platinum-card:airline-fee:calendar-year", "card:american-express-platinum-card", "american-express-platinum-card:airline-fee", "calendar-year"),
            usage("benefit:american-express-platinum-card:uber-cash:calendar-month", "card:american-express-platinum-card", "american-express-platinum-card:uber-cash", "calendar-month"),
            usage("benefit:american-express-platinum-card:uber-cash-december-bonus:calendar-month-december", "card:american-express-platinum-card", "american-express-platinum-card:uber-cash-december-bonus", "calendar-month-december", "american-express-platinum-card:uber-cash"),
            usage("benefit:american-express-platinum-card:saks:calendar-half-h1", "card:american-express-platinum-card", "american-express-platinum-card:saks", "calendar-half-h1"),
            usage("benefit:american-express-platinum-card:saks:calendar-half-h2", "card:american-express-platinum-card", "american-express-platinum-card:saks", "calendar-half-h2"),
            usage("benefit:american-express-platinum-card:resy:calendar-quarter-q1", "card:american-express-platinum-card", "american-express-platinum-card:resy", "calendar-quarter-q1"),
            usage("benefit:american-express-platinum-card:resy:calendar-quarter-q2", "card:american-express-platinum-card", "american-express-platinum-card:resy", "calendar-quarter-q2"),
            usage("benefit:american-express-platinum-card:resy:calendar-quarter-q3", "card:american-express-platinum-card", "american-express-platinum-card:resy", "calendar-quarter-q3"),
            usage("benefit:american-express-platinum-card:resy:calendar-quarter-q4", "card:american-express-platinum-card", "american-express-platinum-card:resy", "calendar-quarter-q4"),
            usage("benefit:american-express-platinum-card:lululemon:calendar-quarter-q1", "card:american-express-platinum-card", "american-express-platinum-card:lululemon", "calendar-quarter-q1"),
            usage("benefit:american-express-platinum-card:lululemon:calendar-quarter-q2", "card:american-express-platinum-card", "american-express-platinum-card:lululemon", "calendar-quarter-q2"),
            usage("benefit:american-express-platinum-card:lululemon:calendar-quarter-q3", "card:american-express-platinum-card", "american-express-platinum-card:lululemon", "calendar-quarter-q3"),
            usage("benefit:american-express-platinum-card:lululemon:calendar-quarter-q4", "card:american-express-platinum-card", "american-express-platinum-card:lululemon", "calendar-quarter-q4"),
            usage("benefit:american-express-platinum-card:hotel:calendar-half-h1", "card:american-express-platinum-card", "american-express-platinum-card:hotel", "calendar-half-h1"),
            usage("benefit:american-express-platinum-card:hotel:calendar-half-h2", "card:american-express-platinum-card", "american-express-platinum-card:hotel", "calendar-half-h2"),
            usage("benefit:american-express-platinum-card:digital-entertainment:calendar-month", "card:american-express-platinum-card", "american-express-platinum-card:digital-entertainment", "calendar-month"),
            usage("benefit:american-express-platinum-card:uber-one:calendar-year", "card:american-express-platinum-card", "american-express-platinum-card:uber-one", "calendar-year"),
            usage("benefit:american-express-platinum-card:oura:calendar-year", "card:american-express-platinum-card", "american-express-platinum-card:oura", "calendar-year"),
            usage("benefit:american-express-platinum-card:walmart-plus:calendar-month", "card:american-express-platinum-card", "american-express-platinum-card:walmart-plus", "calendar-month")
          ]
        },
        "American Express Business Platinum Card": {
          catalogKey: "card:american-express-business-platinum-card",
          productKey: "american-express-business-platinum-card",
          exactAliases: ["American Express Business Platinum Card", "Business Platinum Card from American Express", "Business Platinum Card®"],
          benefits: [
            usage("benefit:american-express-business-platinum-card:airline-fee:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:airline-fee", "calendar-year"),
            usage("benefit:american-express-business-platinum-card:hotel:calendar-half-h1", "card:american-express-business-platinum-card", "american-express-business-platinum-card:hotel", "calendar-half-h1"),
            usage("benefit:american-express-business-platinum-card:hotel:calendar-half-h2", "card:american-express-business-platinum-card", "american-express-business-platinum-card:hotel", "calendar-half-h2"),
            usage("benefit:american-express-business-platinum-card:dell:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:dell", "calendar-year"),
            excluded("benefit:american-express-business-platinum-card:adobe:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:adobe", "calendar-year", "spend"),
            excluded("benefit:american-express-business-platinum-card:amex-travel-flight:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:amex-travel-flight", "calendar-year", "spend"),
            excluded("benefit:american-express-business-platinum-card:one-ap:calendar-year", "card:american-express-business-platinum-card", "american-express-business-platinum-card:one-ap", "calendar-year", "spend"),
            usage("benefit:american-express-business-platinum-card:hilton:card-anniversary-quarter", "card:american-express-business-platinum-card", "american-express-business-platinum-card:hilton", "card-anniversary-quarter"),
            usage("benefit:american-express-business-platinum-card:indeed:calendar-quarter", "card:american-express-business-platinum-card", "american-express-business-platinum-card:indeed", "calendar-quarter"),
            usage("benefit:american-express-business-platinum-card:wireless:calendar-month", "card:american-express-business-platinum-card", "american-express-business-platinum-card:wireless", "calendar-month")
          ]
        },
        "American Express Business Gold Card": {
          catalogKey: "card:american-express-business-gold-card",
          productKey: "american-express-business-gold-card",
          exactAliases: ["American Express Business Gold Card", "Business Gold Card from American Express", "Amex Business Gold Card"],
          benefits: [
            usage("benefit:american-express-business-gold-card:flexible-business:calendar-month", "card:american-express-business-gold-card", "american-express-business-gold-card:flexible-business", "calendar-month"),
            usage("benefit:american-express-business-gold-card:walmart-plus:calendar-month", "card:american-express-business-gold-card", "american-express-business-gold-card:walmart-plus", "calendar-month")
          ]
        },
        "Hilton Honors American Express Aspire Card": {
          catalogKey: "card:hilton-honors-american-express-aspire-card",
          productKey: "hilton-honors-american-express-aspire-card",
          exactAliases: ["Hilton Honors American Express Aspire Card", "Hilton Honors Aspire Card"],
          benefits: [
            excluded("benefit:hilton-honors-american-express-aspire-card:free-night:card-anniversary-year", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:free-night", "card-anniversary-year", "certificate"),
            usage("benefit:hilton-honors-american-express-aspire-card:flight:calendar-quarter", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:flight", "calendar-quarter"),
            usage("benefit:hilton-honors-american-express-aspire-card:hilton-resort:calendar-half-h1", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:hilton-resort", "calendar-half-h1"),
            usage("benefit:hilton-honors-american-express-aspire-card:hilton-resort:calendar-half-h2", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:hilton-resort", "calendar-half-h2"),
            usage("benefit:hilton-honors-american-express-aspire-card:clear-plus:calendar-year", "card:hilton-honors-american-express-aspire-card", "hilton-honors-american-express-aspire-card:clear-plus", "calendar-year")
          ]
        },
        "Hilton Honors American Express Surpass Card": {
          catalogKey: "card:hilton-honors-american-express-surpass-card",
          productKey: "hilton-honors-american-express-surpass-card",
          exactAliases: ["Hilton Honors American Express Surpass Card", "Hilton Honors Surpass Card"],
          benefits: [usage("benefit:hilton-honors-american-express-surpass-card:hilton:calendar-quarter", "card:hilton-honors-american-express-surpass-card", "hilton-honors-american-express-surpass-card:hilton", "calendar-quarter")]
        },
        "Hilton Honors American Express Business Card": {
          catalogKey: "card:hilton-honors-american-express-business-card",
          productKey: "hilton-honors-american-express-business-card",
          exactAliases: ["Hilton Honors American Express Business Card", "Hilton Honors Business Card"],
          benefits: [usage("benefit:hilton-honors-american-express-business-card:hilton:card-anniversary-quarter", "card:hilton-honors-american-express-business-card", "hilton-honors-american-express-business-card:hilton", "card-anniversary-quarter")]
        },
        "Delta SkyMiles Gold American Express Card": {
          catalogKey: "card:delta-skymiles-gold-american-express-card",
          productKey: "delta-skymiles-gold-american-express-card",
          exactAliases: ["Delta SkyMiles Gold American Express Card", "Delta SkyMiles Gold Amex Card"],
          benefits: [
            excluded("benefit:delta-skymiles-gold-american-express-card:delta-flight:card-anniversary-year", "card:delta-skymiles-gold-american-express-card", "delta-skymiles-gold-american-express-card:delta-flight", "card-anniversary-year", "spend"),
            usage("benefit:delta-skymiles-gold-american-express-card:delta-stays:card-anniversary-year", "card:delta-skymiles-gold-american-express-card", "delta-skymiles-gold-american-express-card:delta-stays", "card-anniversary-year")
          ]
        },
        "Delta SkyMiles Platinum American Express Card": {
          catalogKey: "card:delta-skymiles-platinum-american-express-card",
          productKey: "delta-skymiles-platinum-american-express-card",
          exactAliases: ["Delta SkyMiles Platinum American Express Card", "Delta SkyMiles Platinum Amex Card"],
          benefits: [
            usage("benefit:delta-skymiles-platinum-american-express-card:delta-stays:card-anniversary-year", "card:delta-skymiles-platinum-american-express-card", "delta-skymiles-platinum-american-express-card:delta-stays", "card-anniversary-year"),
            usage("benefit:delta-skymiles-platinum-american-express-card:resy:calendar-month", "card:delta-skymiles-platinum-american-express-card", "delta-skymiles-platinum-american-express-card:resy", "calendar-month"),
            usage("benefit:delta-skymiles-platinum-american-express-card:rideshare:calendar-month", "card:delta-skymiles-platinum-american-express-card", "delta-skymiles-platinum-american-express-card:rideshare", "calendar-month")
          ]
        },
        "Delta SkyMiles Reserve American Express Card": {
          catalogKey: "card:delta-skymiles-reserve-american-express-card",
          productKey: "delta-skymiles-reserve-american-express-card",
          exactAliases: ["Delta SkyMiles Reserve American Express Card", "Delta SkyMiles Reserve Amex Card"],
          benefits: [
            usage("benefit:delta-skymiles-reserve-american-express-card:delta-stays:card-anniversary-year", "card:delta-skymiles-reserve-american-express-card", "delta-skymiles-reserve-american-express-card:delta-stays", "card-anniversary-year"),
            usage("benefit:delta-skymiles-reserve-american-express-card:resy:calendar-month", "card:delta-skymiles-reserve-american-express-card", "delta-skymiles-reserve-american-express-card:resy", "calendar-month"),
            usage("benefit:delta-skymiles-reserve-american-express-card:rideshare:calendar-month", "card:delta-skymiles-reserve-american-express-card", "delta-skymiles-reserve-american-express-card:rideshare", "calendar-month")
          ]
        },
        "Marriott Bonvoy Brilliant American Express Card": {
          catalogKey: "card:marriott-bonvoy-brilliant-american-express-card",
          productKey: "marriott-bonvoy-brilliant-american-express-card",
          exactAliases: ["Marriott Bonvoy Brilliant American Express Card", "Marriott Bonvoy Brilliant Card"],
          benefits: [
            excluded("benefit:marriott-bonvoy-brilliant-american-express-card:free-night:card-anniversary-year", "card:marriott-bonvoy-brilliant-american-express-card", "marriott-bonvoy-brilliant-american-express-card:free-night", "card-anniversary-year", "certificate"),
            usage("benefit:marriott-bonvoy-brilliant-american-express-card:dining:calendar-month", "card:marriott-bonvoy-brilliant-american-express-card", "marriott-bonvoy-brilliant-american-express-card:dining", "calendar-month")
          ]
        },
        "Marriott Bonvoy Business American Express Card": {
          catalogKey: "card:marriott-bonvoy-business-american-express-card",
          productKey: "marriott-bonvoy-business-american-express-card",
          exactAliases: ["Marriott Bonvoy Business American Express Card", "Marriott Bonvoy Business Card"],
          benefits: [
            excluded("benefit:marriott-bonvoy-business-american-express-card:free-night:card-anniversary-year", "card:marriott-bonvoy-business-american-express-card", "marriott-bonvoy-business-american-express-card:free-night", "card-anniversary-year", "certificate"),
            excluded("benefit:marriott-bonvoy-business-american-express-card:elite-night-credits:card-anniversary-year", "card:marriott-bonvoy-business-american-express-card", "marriott-bonvoy-business-american-express-card:elite-night-credits", "card-anniversary-year", "status_or_access"),
            excluded("benefit:marriott-bonvoy-business-american-express-card:gold-elite-status:card-anniversary-year", "card:marriott-bonvoy-business-american-express-card", "marriott-bonvoy-business-american-express-card:gold-elite-status", "card-anniversary-year", "status_or_access")
          ]
        }
      };
      AMEX_WRITABLE_DESTINATIONS = Object.values(AMEX_CATALOG_IDENTITY_REGISTRY).flatMap((product) => product.benefits.flatMap((benefit) => benefit.sourceSemantics === "usage" && benefit.sourceCreditKey ? [{
        productKey: product.productKey,
        creditFamilyKey: benefit.creditFamilyKey,
        periodKey: benefit.periodKey,
        sourceCreditKey: benefit.sourceCreditKey
      }] : []));
    }
  });

  // src/lib/american-express-card-catalog.ts
  var americanExpressCardCatalogBase, americanExpressCardCatalog;
  var init_american_express_card_catalog = __esm({
    "src/lib/american-express-card-catalog.ts"() {
      "use strict";
      init_catalog_registry();
      americanExpressCardCatalogBase = {
        "American Express Gold Card": {
          catalogKey: "card:american-express-gold-card",
          name: "American Express Gold Card",
          issuer: "American Express",
          annualFee: 325,
          imageUrl: "/images/cards/american-express-gold-card.png",
          benefits: [
            {
              catalogKey: "benefit:american-express-gold-card:uber-cash:calendar-month",
              parentCatalogKey: "card:american-express-gold-card",
              description: "$10 Monthly Uber Cash",
              category: "Travel",
              maxAmount: 10,
              frequency: "MONTHLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:american-express-gold-card:dining:calendar-month",
              parentCatalogKey: "card:american-express-gold-card",
              description: "$10 Monthly Dining Credit (e.g., Grubhub, Cheesecake Factory)",
              category: "Dining",
              maxAmount: 10,
              frequency: "MONTHLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:american-express-gold-card:dunkin:calendar-month",
              parentCatalogKey: "card:american-express-gold-card",
              description: "$7 Monthly Dunkin Credit",
              category: "Dining",
              maxAmount: 7,
              frequency: "MONTHLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:american-express-gold-card:resy:calendar-half-h1",
              parentCatalogKey: "card:american-express-gold-card",
              description: "$50 Resy Credit (Jan-Jun)",
              category: "Dining",
              maxAmount: 50,
              frequency: "YEARLY",
              // This specific credit occurs once a year in this window
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 6
            },
            {
              catalogKey: "benefit:american-express-gold-card:resy:calendar-half-h2",
              parentCatalogKey: "card:american-express-gold-card",
              description: "$50 Resy Credit (Jul-Dec)",
              category: "Dining",
              maxAmount: 50,
              frequency: "YEARLY",
              // This specific credit occurs once a year in this window
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 7,
              // July
              fixedCycleDurationMonths: 6
            }
          ]
        },
        "American Express Platinum Card": {
          productKey: "american-express-platinum-card",
          catalogKey: "card:american-express-platinum-card",
          name: "American Express Platinum Card",
          issuer: "American Express",
          annualFee: 895,
          imageUrl: "/images/cards/american-express-platinum-card.png",
          benefits: [
            // Existing benefits that remain unchanged
            {
              catalogKey: "benefit:american-express-platinum-card:airline-fee:calendar-year",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$200 Airline Fee Credit (Incidental Fees, select one airline)",
              category: "Travel",
              maxAmount: 200,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            },
            {
              catalogKey: "benefit:american-express-platinum-card:uber-cash:calendar-month",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$15 Monthly Uber Cash ($35 in December)",
              category: "Travel",
              maxAmount: 15,
              frequency: "MONTHLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:american-express-platinum-card:uber-cash-december-bonus:calendar-month-december",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$20 Additional Uber Cash (December)",
              category: "Travel",
              maxAmount: 20,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              // Specific to December
              fixedCycleStartMonth: 12,
              // December
              fixedCycleDurationMonths: 1
              // For the month of December
            },
            {
              catalogKey: "benefit:american-express-platinum-card:saks:calendar-half-h1",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$50 Saks Fifth Avenue Credit (Jan-Jun)",
              category: "Shopping",
              maxAmount: 50,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              fixedCycleDurationMonths: 6
            },
            {
              catalogKey: "benefit:american-express-platinum-card:saks:calendar-half-h2",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$50 Saks Fifth Avenue Credit (Jul-Dec)",
              category: "Shopping",
              maxAmount: 50,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 7,
              fixedCycleDurationMonths: 6
            },
            // NEW 2025 BENEFITS - Quarterly benefits split by quarter
            {
              catalogKey: "benefit:american-express-platinum-card:resy:calendar-quarter-q1",
              parentCatalogKey: "card:american-express-platinum-card",
              productKey: "american-express-platinum-card",
              creditFamilyKey: "american-express-platinum-card:resy",
              periodKey: "calendar-quarter-q1",
              description: "$100 Quarterly Resy Dining Credit (Q1: Jan-Mar)",
              category: "Dining",
              maxAmount: 100,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 3
              // Q1: Jan-Mar
            },
            {
              catalogKey: "benefit:american-express-platinum-card:resy:calendar-quarter-q2",
              parentCatalogKey: "card:american-express-platinum-card",
              productKey: "american-express-platinum-card",
              creditFamilyKey: "american-express-platinum-card:resy",
              periodKey: "calendar-quarter-q2",
              description: "$100 Quarterly Resy Dining Credit (Q2: Apr-Jun)",
              category: "Dining",
              maxAmount: 100,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 4,
              // April
              fixedCycleDurationMonths: 3
              // Q2: Apr-Jun
            },
            {
              catalogKey: "benefit:american-express-platinum-card:resy:calendar-quarter-q3",
              parentCatalogKey: "card:american-express-platinum-card",
              productKey: "american-express-platinum-card",
              creditFamilyKey: "american-express-platinum-card:resy",
              periodKey: "calendar-quarter-q3",
              description: "$100 Quarterly Resy Dining Credit (Q3: Jul-Sep)",
              category: "Dining",
              maxAmount: 100,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 7,
              // July
              fixedCycleDurationMonths: 3
              // Q3: Jul-Sep
            },
            {
              catalogKey: "benefit:american-express-platinum-card:resy:calendar-quarter-q4",
              parentCatalogKey: "card:american-express-platinum-card",
              productKey: "american-express-platinum-card",
              creditFamilyKey: "american-express-platinum-card:resy",
              periodKey: "calendar-quarter-q4",
              description: "$100 Quarterly Resy Dining Credit (Q4: Oct-Dec)",
              category: "Dining",
              maxAmount: 100,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 10,
              // October
              fixedCycleDurationMonths: 3
              // Q4: Oct-Dec
            },
            {
              catalogKey: "benefit:american-express-platinum-card:lululemon:calendar-quarter-q1",
              parentCatalogKey: "card:american-express-platinum-card",
              productKey: "american-express-platinum-card",
              creditFamilyKey: "american-express-platinum-card:lululemon",
              periodKey: "calendar-quarter-q1",
              description: "$75 Quarterly Lululemon Credit (Q1: Jan-Mar)",
              category: "Shopping",
              maxAmount: 75,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 3
              // Q1: Jan-Mar
            },
            {
              catalogKey: "benefit:american-express-platinum-card:lululemon:calendar-quarter-q2",
              parentCatalogKey: "card:american-express-platinum-card",
              productKey: "american-express-platinum-card",
              creditFamilyKey: "american-express-platinum-card:lululemon",
              periodKey: "calendar-quarter-q2",
              description: "$75 Quarterly Lululemon Credit (Q2: Apr-Jun)",
              category: "Shopping",
              maxAmount: 75,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 4,
              // April
              fixedCycleDurationMonths: 3
              // Q2: Apr-Jun
            },
            {
              catalogKey: "benefit:american-express-platinum-card:lululemon:calendar-quarter-q3",
              parentCatalogKey: "card:american-express-platinum-card",
              productKey: "american-express-platinum-card",
              creditFamilyKey: "american-express-platinum-card:lululemon",
              periodKey: "calendar-quarter-q3",
              description: "$75 Quarterly Lululemon Credit (Q3: Jul-Sep)",
              category: "Shopping",
              maxAmount: 75,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 7,
              // July
              fixedCycleDurationMonths: 3
              // Q3: Jul-Sep
            },
            {
              catalogKey: "benefit:american-express-platinum-card:lululemon:calendar-quarter-q4",
              parentCatalogKey: "card:american-express-platinum-card",
              productKey: "american-express-platinum-card",
              creditFamilyKey: "american-express-platinum-card:lululemon",
              periodKey: "calendar-quarter-q4",
              description: "$75 Quarterly Lululemon Credit (Q4: Oct-Dec)",
              category: "Shopping",
              maxAmount: 75,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 10,
              // October
              fixedCycleDurationMonths: 3
              // Q4: Oct-Dec
            },
            {
              catalogKey: "benefit:american-express-platinum-card:hotel:calendar-half-h1",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jan-Jun)",
              category: "Travel",
              maxAmount: 300,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 6
            },
            {
              catalogKey: "benefit:american-express-platinum-card:hotel:calendar-half-h2",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jul-Dec)",
              category: "Travel",
              maxAmount: 300,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 7,
              // July
              fixedCycleDurationMonths: 6
            },
            {
              catalogKey: "benefit:american-express-platinum-card:digital-entertainment:calendar-month",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$25 Monthly Digital Entertainment Credit",
              category: "Entertainment",
              maxAmount: 25,
              frequency: "MONTHLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:american-express-platinum-card:uber-one:calendar-year",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$120 Annual Uber One Membership Credit",
              category: "Membership",
              maxAmount: 120,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            },
            {
              catalogKey: "benefit:american-express-platinum-card:oura:calendar-year",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$200 Annual Oura Ring Credit",
              category: "Wellness",
              maxAmount: 200,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            },
            {
              catalogKey: "benefit:american-express-platinum-card:walmart-plus:calendar-month",
              parentCatalogKey: "card:american-express-platinum-card",
              description: "$12.95 Monthly Walmart+ Membership Credit",
              category: "Membership",
              maxAmount: 12.95,
              frequency: "MONTHLY",
              percentage: 0
            }
          ]
        },
        "American Express Business Platinum Card": {
          catalogKey: "card:american-express-business-platinum-card",
          name: "American Express Business Platinum Card",
          issuer: "American Express",
          annualFee: 895,
          imageUrl: "/images/cards/american-express-business-platinum-card.png",
          benefits: [
            // Existing benefits that remain unchanged
            {
              catalogKey: "benefit:american-express-business-platinum-card:airline-fee:calendar-year",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$200 Airline Fee Credit",
              category: "Travel",
              maxAmount: 200,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            },
            // NEW 2025 BENEFITS
            {
              catalogKey: "benefit:american-express-business-platinum-card:hotel:calendar-half-h1",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jan-Jun)",
              category: "Travel",
              maxAmount: 300,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 6
            },
            {
              catalogKey: "benefit:american-express-business-platinum-card:hotel:calendar-half-h2",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$300 Semi-Annual Hotel Credit (FHR/THC prepaid bookings - Jul-Dec)",
              category: "Travel",
              maxAmount: 300,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 7,
              // July
              fixedCycleDurationMonths: 6
            },
            {
              catalogKey: "benefit:american-express-business-platinum-card:dell:calendar-year",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$1,150 Annual Dell Technologies Credit",
              category: "Electronics",
              maxAmount: 1150,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            },
            {
              catalogKey: "benefit:american-express-business-platinum-card:adobe:calendar-year",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$250 Annual Adobe Credit (after $600 spend)",
              category: "Software",
              maxAmount: 250,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            },
            // High-spending benefits for $250K+ annual spenders
            {
              catalogKey: "benefit:american-express-business-platinum-card:amex-travel-flight:calendar-year",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$1,200 Annual Amex Travel Flight Credit (High Spender Benefit)",
              category: "Travel",
              maxAmount: 1200,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            },
            {
              catalogKey: "benefit:american-express-business-platinum-card:one-ap:calendar-year",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$2,400 Annual One AP Statement Credit (High Spender Benefit)",
              category: "Business Services",
              maxAmount: 2400,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            },
            // NEW BENEFIT: Quarterly Hilton Credit
            {
              catalogKey: "benefit:american-express-business-platinum-card:hilton:card-anniversary-quarter",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$50 Quarterly Hilton Credit (Hilton properties)",
              category: "Travel",
              maxAmount: 50,
              frequency: "QUARTERLY",
              percentage: 0,
              cycleAlignment: "CARD_ANNIVERSARY",
              occurrencesInCycle: 1
            },
            {
              catalogKey: "benefit:american-express-business-platinum-card:indeed:calendar-quarter",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$90 Quarterly Indeed Credit (Job Postings)",
              category: "Business Services",
              maxAmount: 90,
              frequency: "QUARTERLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 3
              // Calendar quarters
            },
            {
              catalogKey: "benefit:american-express-business-platinum-card:wireless:calendar-month",
              parentCatalogKey: "card:american-express-business-platinum-card",
              description: "$10 Monthly Wireless Bill Credit",
              category: "Business Services",
              maxAmount: 10,
              frequency: "MONTHLY",
              percentage: 0
            }
          ]
        },
        "American Express Business Gold Card": {
          catalogKey: "card:american-express-business-gold-card",
          name: "American Express Business Gold Card",
          issuer: "American Express",
          annualFee: 375,
          imageUrl: "/images/cards/american-express-business-gold-card.png",
          benefits: [
            {
              catalogKey: "benefit:american-express-business-gold-card:flexible-business:calendar-month",
              parentCatalogKey: "card:american-express-business-gold-card",
              description: "$20 Monthly Flexible Business Credit (FedEx, Grubhub, Office Supply)",
              category: "Business",
              maxAmount: 20,
              frequency: "MONTHLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:american-express-business-gold-card:walmart-plus:calendar-month",
              parentCatalogKey: "card:american-express-business-gold-card",
              description: "$12.95 Monthly Walmart+ Membership Credit",
              category: "Membership",
              maxAmount: 12.95,
              frequency: "MONTHLY",
              percentage: 0
            }
          ]
        },
        "Hilton Honors American Express Aspire Card": {
          catalogKey: "card:hilton-honors-american-express-aspire-card",
          name: "Hilton Honors American Express Aspire Card",
          issuer: "American Express",
          annualFee: 550,
          imageUrl: "/images/cards/hilton-honors-american-express-aspire-card.png",
          benefits: [
            {
              catalogKey: "benefit:hilton-honors-american-express-aspire-card:free-night:card-anniversary-year",
              parentCatalogKey: "card:hilton-honors-american-express-aspire-card",
              description: "Annual Free Night Reward",
              category: "Travel",
              maxAmount: 0,
              frequency: "YEARLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:hilton-honors-american-express-aspire-card:flight:calendar-quarter",
              parentCatalogKey: "card:hilton-honors-american-express-aspire-card",
              description: "$50 Quarterly Flight Credit",
              category: "Travel",
              maxAmount: 50,
              frequency: "QUARTERLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 3
              // Calendar quarters
            },
            {
              catalogKey: "benefit:hilton-honors-american-express-aspire-card:hilton-resort:calendar-half-h1",
              parentCatalogKey: "card:hilton-honors-american-express-aspire-card",
              description: "$200 Semi-Annual Hilton Resort Credit (Jan-Jun)",
              category: "Travel",
              maxAmount: 200,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              fixedCycleDurationMonths: 6
            },
            {
              catalogKey: "benefit:hilton-honors-american-express-aspire-card:hilton-resort:calendar-half-h2",
              parentCatalogKey: "card:hilton-honors-american-express-aspire-card",
              description: "$200 Semi-Annual Hilton Resort Credit (Jul-Dec)",
              category: "Travel",
              maxAmount: 200,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 7,
              fixedCycleDurationMonths: 6
            },
            {
              catalogKey: "benefit:hilton-honors-american-express-aspire-card:clear-plus:calendar-year",
              parentCatalogKey: "card:hilton-honors-american-express-aspire-card",
              description: "$189 CLEAR Plus Credit",
              category: "Travel",
              maxAmount: 189,
              frequency: "YEARLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 12
              // Calendar year
            }
          ]
        },
        "Hilton Honors American Express Surpass Card": {
          catalogKey: "card:hilton-honors-american-express-surpass-card",
          name: "Hilton Honors American Express Surpass Card",
          issuer: "American Express",
          annualFee: 150,
          imageUrl: "/images/cards/hilton-honors-american-express-surpass-card.png",
          benefits: [
            {
              catalogKey: "benefit:hilton-honors-american-express-surpass-card:hilton:calendar-quarter",
              parentCatalogKey: "card:hilton-honors-american-express-surpass-card",
              description: "$50 Quarterly Hilton Credit",
              category: "Travel",
              maxAmount: 50,
              frequency: "QUARTERLY",
              percentage: 0,
              cycleAlignment: "CALENDAR_FIXED",
              fixedCycleStartMonth: 1,
              // January
              fixedCycleDurationMonths: 3
              // Calendar quarters
            }
          ]
        },
        "Hilton Honors American Express Business Card": {
          catalogKey: "card:hilton-honors-american-express-business-card",
          name: "Hilton Honors American Express Business Card",
          issuer: "American Express",
          annualFee: 195,
          imageUrl: "/images/cards/hilton-honors-american-express-business-card.png",
          benefits: [
            {
              catalogKey: "benefit:hilton-honors-american-express-business-card:hilton:card-anniversary-quarter",
              parentCatalogKey: "card:hilton-honors-american-express-business-card",
              description: "$60 Quarterly Hilton Credit ($240 annual)",
              category: "Travel",
              maxAmount: 60,
              frequency: "QUARTERLY",
              percentage: 0
            }
          ]
        },
        "Delta SkyMiles Gold American Express Card": {
          catalogKey: "card:delta-skymiles-gold-american-express-card",
          name: "Delta SkyMiles Gold American Express Card",
          issuer: "American Express",
          annualFee: 150,
          imageUrl: "/images/cards/delta-skymiles-gold-american-express-card.png",
          benefits: [
            {
              catalogKey: "benefit:delta-skymiles-gold-american-express-card:delta-flight:card-anniversary-year",
              parentCatalogKey: "card:delta-skymiles-gold-american-express-card",
              description: "$200 Delta Flight Credit (after $10k spend)",
              category: "Travel",
              maxAmount: 200,
              frequency: "YEARLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:delta-skymiles-gold-american-express-card:delta-stays:card-anniversary-year",
              parentCatalogKey: "card:delta-skymiles-gold-american-express-card",
              description: "$100 Delta Stays Credit",
              category: "Travel",
              maxAmount: 100,
              frequency: "YEARLY",
              percentage: 0
            }
          ]
        },
        "Delta SkyMiles Platinum American Express Card": {
          catalogKey: "card:delta-skymiles-platinum-american-express-card",
          name: "Delta SkyMiles Platinum American Express Card",
          issuer: "American Express",
          annualFee: 350,
          imageUrl: "/images/cards/delta-skymiles-platinum-american-express-card.png",
          benefits: [
            {
              catalogKey: "benefit:delta-skymiles-platinum-american-express-card:delta-stays:card-anniversary-year",
              parentCatalogKey: "card:delta-skymiles-platinum-american-express-card",
              description: "$150 Delta Stays Credit",
              category: "Travel",
              maxAmount: 150,
              frequency: "YEARLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:delta-skymiles-platinum-american-express-card:resy:calendar-month",
              parentCatalogKey: "card:delta-skymiles-platinum-american-express-card",
              description: "$10 Monthly Resy Credit",
              category: "Dining",
              maxAmount: 10,
              frequency: "MONTHLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:delta-skymiles-platinum-american-express-card:rideshare:calendar-month",
              parentCatalogKey: "card:delta-skymiles-platinum-american-express-card",
              description: "$10 Monthly Rideshare Credit",
              category: "Travel",
              maxAmount: 10,
              frequency: "MONTHLY",
              percentage: 0
            }
          ]
        },
        "Delta SkyMiles Reserve American Express Card": {
          catalogKey: "card:delta-skymiles-reserve-american-express-card",
          name: "Delta SkyMiles Reserve American Express Card",
          issuer: "American Express",
          annualFee: 650,
          imageUrl: "/images/cards/delta-skymiles-reserve-american-express-card.png",
          benefits: [
            {
              catalogKey: "benefit:delta-skymiles-reserve-american-express-card:delta-stays:card-anniversary-year",
              parentCatalogKey: "card:delta-skymiles-reserve-american-express-card",
              description: "$200 Delta Stays Credit",
              category: "Travel",
              maxAmount: 200,
              frequency: "YEARLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:delta-skymiles-reserve-american-express-card:resy:calendar-month",
              parentCatalogKey: "card:delta-skymiles-reserve-american-express-card",
              description: "$20 Monthly Resy Credit",
              category: "Dining",
              maxAmount: 20,
              frequency: "MONTHLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:delta-skymiles-reserve-american-express-card:rideshare:calendar-month",
              parentCatalogKey: "card:delta-skymiles-reserve-american-express-card",
              description: "$10 Monthly Rideshare Credit",
              category: "Travel",
              maxAmount: 10,
              frequency: "MONTHLY",
              percentage: 0
            }
          ]
        },
        "Marriott Bonvoy Brilliant American Express Card": {
          catalogKey: "card:marriott-bonvoy-brilliant-american-express-card",
          name: "Marriott Bonvoy Brilliant American Express Card",
          issuer: "American Express",
          annualFee: 650,
          imageUrl: "/images/cards/marriott-bonvoy-brilliant-american-express-card.png",
          benefits: [
            {
              catalogKey: "benefit:marriott-bonvoy-brilliant-american-express-card:free-night:card-anniversary-year",
              parentCatalogKey: "card:marriott-bonvoy-brilliant-american-express-card",
              description: "Annual Free Night Award (up to 85k points)",
              category: "Travel",
              maxAmount: 0,
              frequency: "YEARLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:marriott-bonvoy-brilliant-american-express-card:dining:calendar-month",
              parentCatalogKey: "card:marriott-bonvoy-brilliant-american-express-card",
              description: "$25 Monthly Dining Credit",
              category: "Dining",
              maxAmount: 25,
              frequency: "MONTHLY",
              percentage: 0
            }
          ]
        },
        "Marriott Bonvoy Business American Express Card": {
          catalogKey: "card:marriott-bonvoy-business-american-express-card",
          name: "Marriott Bonvoy Business American Express Card",
          issuer: "American Express",
          annualFee: 125,
          imageUrl: "/images/cards/marriott-bonvoy-business-american-express-card.png",
          benefits: [
            {
              catalogKey: "benefit:marriott-bonvoy-business-american-express-card:free-night:card-anniversary-year",
              parentCatalogKey: "card:marriott-bonvoy-business-american-express-card",
              description: "Annual Free Night Award (up to 35,000 points)",
              category: "Travel",
              maxAmount: 0,
              frequency: "YEARLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:marriott-bonvoy-business-american-express-card:elite-night-credits:card-anniversary-year",
              parentCatalogKey: "card:marriott-bonvoy-business-american-express-card",
              description: "15 Elite Night Credits towards Marriott Bonvoy Elite status",
              category: "Travel",
              maxAmount: 0,
              frequency: "YEARLY",
              percentage: 0
            },
            {
              catalogKey: "benefit:marriott-bonvoy-business-american-express-card:gold-elite-status:card-anniversary-year",
              parentCatalogKey: "card:marriott-bonvoy-business-american-express-card",
              description: "Marriott Bonvoy Gold Elite Status (complimentary)",
              category: "Travel",
              maxAmount: 0,
              frequency: "YEARLY",
              percentage: 0
            }
          ]
        }
      };
      americanExpressCardCatalog = Object.fromEntries(
        Object.entries(americanExpressCardCatalogBase).map(([name, card]) => {
          const identity = AMEX_CATALOG_IDENTITY_REGISTRY[name];
          if (!identity || identity.catalogKey !== card.catalogKey) {
            throw new Error(`AMEX catalog product identity registry is out of sync for ${name}.`);
          }
          const identityByCatalogKey = new Map(
            identity.benefits.map((benefit) => [benefit.catalogKey, benefit])
          );
          if (identityByCatalogKey.size !== identity.benefits.length) {
            throw new Error(`AMEX catalog identity registry has duplicate benefit keys for ${name}.`);
          }
          const projectedBenefits = card.benefits.map((benefit) => {
            const benefitIdentity = identityByCatalogKey.get(benefit.catalogKey);
            if (!benefitIdentity || benefitIdentity.parentCatalogKey !== card.catalogKey) {
              throw new Error(`AMEX catalog benefit identity registry is out of sync for ${benefit.catalogKey}.`);
            }
            identityByCatalogKey.delete(benefit.catalogKey);
            return {
              ...benefit,
              productKey: identity.productKey,
              creditFamilyKey: benefitIdentity.creditFamilyKey,
              periodKey: benefitIdentity.periodKey,
              sourceSemantics: benefitIdentity.sourceSemantics,
              sourceCreditKey: benefitIdentity.sourceCreditKey
            };
          });
          if (Number(identityByCatalogKey.size) !== 0) {
            throw new Error(`AMEX catalog identity registry has definitions missing from ${name}.`);
          }
          return [name, {
            ...card,
            productKey: identity.productKey,
            benefits: projectedBenefits
          }];
        })
      );
    }
  });

  // src/lib/amex-catalog/normalization.ts
  function normalizeAmexSelectionText(value) {
    return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/\+/g, " plus ").replace(/\bamex\b/gi, " american express ").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  }
  var init_normalization = __esm({
    "src/lib/amex-catalog/normalization.ts"() {
      "use strict";
    }
  });

  // src/lib/amex-catalog/period-resolution.ts
  function periodKeysForExactRange(startDate, endDate) {
    const start = /* @__PURE__ */ new Date(`${startDate}T00:00:00.000Z`);
    const end = /* @__PURE__ */ new Date(`${endDate}T00:00:00.000Z`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || start.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate) return [];
    const endOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const keys = [];
    if (start.getUTCDate() === 1 && end.getTime() === endOfMonth.getTime()) {
      keys.push("calendar-month");
      if (start.getUTCMonth() === 11) keys.push("calendar-month-december");
    }
    const quarter = Math.floor(start.getUTCMonth() / 3);
    const quarterEnd = new Date(Date.UTC(start.getUTCFullYear(), quarter * 3 + 3, 0));
    if (start.getUTCMonth() === quarter * 3 && start.getUTCDate() === 1 && end.getTime() === quarterEnd.getTime()) {
      keys.push("calendar-quarter", `calendar-quarter-q${quarter + 1}`, "card-anniversary-quarter");
    }
    const half = start.getUTCMonth() < 6 ? 0 : 1;
    const halfEnd = new Date(Date.UTC(start.getUTCFullYear(), half ? 12 : 6, 0));
    if (start.getUTCMonth() === half * 6 && start.getUTCDate() === 1 && end.getTime() === halfEnd.getTime()) {
      keys.push(`calendar-half-h${half + 1}`);
    }
    const yearEnd = new Date(Date.UTC(start.getUTCFullYear(), 11, 31));
    if (start.getUTCMonth() === 0 && start.getUTCDate() === 1 && end.getTime() === yearEnd.getTime()) {
      keys.push("calendar-year", "card-anniversary-year");
    }
    const plusThreeMonths = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, start.getUTCDate()));
    plusThreeMonths.setUTCDate(plusThreeMonths.getUTCDate() - 1);
    if (plusThreeMonths.getTime() === end.getTime() && !keys.includes("card-anniversary-quarter")) keys.push("card-anniversary-quarter");
    const plusYear = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
    plusYear.setUTCDate(plusYear.getUTCDate() - 1);
    if (plusYear.getTime() === end.getTime() && !keys.includes("card-anniversary-year")) keys.push("card-anniversary-year");
    return keys;
  }
  var init_period_resolution = __esm({
    "src/lib/amex-catalog/period-resolution.ts"() {
      "use strict";
    }
  });

  // src/lib/amex-catalog/source-credit-policy.ts
  function normalizedTokens(value) {
    return new Set(normalizeAmexSelectionText(value).split(" ").filter(Boolean));
  }
  function titleSatisfiesAmexPolicy(policy, title) {
    const normalized = normalizeAmexSelectionText(title);
    const tokens2 = normalizedTokens(title);
    if (policy.forbiddenTokenGroups.some((group) => group.every((token) => tokens2.has(token)))) return false;
    if (policy.exactAliases.some((alias) => normalizeAmexSelectionText(alias) === normalized)) return true;
    return policy.requiredTokenGroups.every((group) => group.some((token) => tokens2.has(token)));
  }
  function parseUsd(quantity) {
    if (quantity.unit !== "USD" || quantity.currency !== "USD") return null;
    if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(quantity.value)) return null;
    const value = Number(quantity.value);
    return Number.isFinite(value) ? value : null;
  }
  function evidenceSatisfiesAmexPolicy(policy, evidence = {}) {
    if (evidence.sourcePeriod) {
      const sourceKeys = periodKeysForExactRange(
        evidence.sourcePeriod.startDate,
        evidence.sourcePeriod.endDate
      );
      if (!sourceKeys.some((key) => policy.compatiblePeriodKeys.includes(key))) return false;
    }
    if (evidence.earnedOrUsed && policy.amountConstraint) {
      const amount = parseUsd(evidence.earnedOrUsed);
      if (amount === null || amount < policy.amountConstraint.minimumUsd || policy.amountConstraint.maximumUsd !== void 0 && amount > policy.amountConstraint.maximumUsd) return false;
    }
    return true;
  }
  var GENERIC_FORBIDDEN_AMEX_CREDIT_TOKEN_GROUPS;
  var init_source_credit_policy = __esm({
    "src/lib/amex-catalog/source-credit-policy.ts"() {
      "use strict";
      init_normalization();
      init_period_resolution();
      GENERIC_FORBIDDEN_AMEX_CREDIT_TOKEN_GROUPS = [
        ["spend"],
        ["free", "night"],
        ["certificate"],
        ["elite"],
        ["access"],
        ["status"],
        ["insurance"],
        ["protection"],
        ["loan"],
        ["link", "profile"]
      ];
    }
  });

  // src/lib/amex-benefit-reader/supported-card-credits.ts
  function containsPhrase(value, phrase) {
    return ` ${value} `.includes(` ${normalizeAmexSelectionText(phrase)} `);
  }
  function isIgnoredAmexCatalogBenefitTitle(title) {
    return REVIEWED_IGNORED_CATALOG_TITLES.has(normalizeAmexSelectionText(title));
  }
  function isExplicitlyUnsupportedTitle(normalizedTitle) {
    return REVIEWED_IGNORED_CATALOG_TITLES.has(normalizedTitle) || EXCLUDED_NON_CREDIT_TITLE_PHRASES.some((phrase) => containsPhrase(normalizedTitle, phrase));
  }
  function isEligibleLocalAmexUsageTitle(title) {
    const normalized = normalizeAmexSelectionText(title);
    return normalized.length > 0 && !isExplicitlyUnsupportedTitle(normalized);
  }
  function evaluateAmexBrowserProductScores(bestScore, runnerUpScore) {
    if (bestScore < AMEX_BROWSER_PRODUCT_MATCH_MIN_SCORE) return "low_confidence";
    if (bestScore - runnerUpScore + Number.EPSILON < AMEX_BROWSER_PRODUCT_MATCH_MIN_MARGIN) return "ambiguous";
    return "accepted";
  }
  function tokens(value, noise = PRODUCT_NOISE) {
    return new Set(normalizeAmexSelectionText(value).split(" ").filter((token) => token && !noise.has(token)));
  }
  function weightedTokenScore(left, right) {
    const a = tokens(left);
    const b = tokens(right);
    const union = /* @__PURE__ */ new Set([...Array.from(a), ...Array.from(b)]);
    if (!union.size) return 0;
    let shared = 0;
    union.forEach((token) => {
      if (a.has(token) && b.has(token)) shared += 1;
    });
    return shared / union.size;
  }
  function hasHardProductConflict(source, candidate, affiliation = false) {
    if (affiliation) return false;
    const sourceTokens = tokens(source, /* @__PURE__ */ new Set());
    const candidateTokens = tokens(candidate, /* @__PURE__ */ new Set());
    if (sourceTokens.has("business") !== candidateTokens.has("business")) return true;
    const sourceCobrand = COBRANDS.find((token) => sourceTokens.has(token));
    const candidateCobrand = COBRANDS.find((token) => candidateTokens.has(token));
    if (sourceCobrand !== candidateCobrand) return true;
    const sourceTier = TIERS.find((token) => sourceTokens.has(token));
    const candidateTier = TIERS.find((token) => candidateTokens.has(token));
    return Boolean(sourceTier && candidateTier && sourceTier !== candidateTier);
  }
  function resolveAmexBrowserProduct(productName) {
    const normalized = normalizeAmexSelectionText(productName);
    const products = Object.entries(AMEX_CATALOG_IDENTITY_REGISTRY);
    for (const [, descriptor] of products) {
      const exactAliases = [...descriptor.exactAliases, ..."affiliationAliases" in descriptor ? descriptor.affiliationAliases : []];
      if (exactAliases.some((alias) => normalizeAmexSelectionText(alias) === normalized)) {
        return { disposition: "matched", match: { productKey: descriptor.productKey, confidence: "exact", score: 1 } };
      }
    }
    const candidates = products.flatMap(([name, descriptor]) => {
      const hardConflict = hasHardProductConflict(productName, name);
      return hardConflict ? [] : [{ productKey: descriptor.productKey, score: weightedTokenScore(productName, name) }];
    }).sort((left, right) => right.score - left.score || left.productKey.localeCompare(right.productKey));
    if (!candidates.length) return { disposition: "hard_conflict", match: null };
    const best = candidates[0];
    const runnerUp = candidates[1]?.score ?? 0;
    const scoreDisposition = evaluateAmexBrowserProductScores(best.score, runnerUp);
    if (scoreDisposition !== "accepted") return { disposition: scoreDisposition, match: null };
    return { disposition: "matched", match: { ...best, confidence: "fuzzy" } };
  }
  function defaultRequiredTokenGroups(sourceCreditKey) {
    const family = sourceCreditKey.slice(sourceCreditKey.lastIndexOf(":") + 1);
    return family.split("-").map((token) => [token]);
  }
  function matchAmexBrowserSyncCredit(productName, trackerTitle, evidence = {}) {
    const product = resolveAmexBrowserProduct(productName);
    if (product.disposition !== "matched") return null;
    const normalizedTitle = normalizeAmexSelectionText(trackerTitle);
    const candidates = BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS.filter((descriptor) => descriptor.productKey === product.match.productKey && titleSatisfiesAmexPolicy(descriptor, trackerTitle) && evidenceSatisfiesAmexPolicy(descriptor, evidence));
    const exact = candidates.filter((descriptor) => descriptor.exactAliases.some((alias) => normalizeAmexSelectionText(alias) === normalizedTitle));
    const resolved = exact.length === 1 ? exact[0] : exact.length > 1 || candidates.length !== 1 ? null : candidates[0];
    if (!resolved) return null;
    return {
      productKey: product.match.productKey,
      creditFamilyKey: resolved.creditFamilyKey,
      sourceCreditKey: resolved.sourceCreditKey
    };
  }
  var EXCLUDED_NON_CREDIT_TITLE_PHRASES, REVIEWED_IGNORED_CATALOG_TITLES, AMEX_BROWSER_PRODUCT_MATCH_MIN_SCORE, AMEX_BROWSER_PRODUCT_MATCH_MIN_MARGIN, PRODUCT_NOISE, COBRANDS, TIERS, REVIEWED_SOURCE_ALIASES, SOURCE_REQUIRED_TOKEN_OVERRIDES, SOURCE_FORBIDDEN_TOKEN_OVERRIDES, BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS;
  var init_supported_card_credits = __esm({
    "src/lib/amex-benefit-reader/supported-card-credits.ts"() {
      "use strict";
      init_american_express_card_catalog();
      init_catalog_registry();
      init_normalization();
      init_source_credit_policy();
      EXCLUDED_NON_CREDIT_TITLE_PHRASES = [
        "access",
        "car rental loss and damage insurance",
        "cell phone protection",
        "free night",
        "global assist hotline",
        "insurance",
        "lounge access",
        "priority pass",
        "protection",
        "status"
      ];
      REVIEWED_IGNORED_CATALOG_TITLES = /* @__PURE__ */ new Set([
        normalizeAmexSelectionText("35% Airline Bonus"),
        normalizeAmexSelectionText("Link Your Resy Profile")
      ]);
      AMEX_BROWSER_PRODUCT_MATCH_MIN_SCORE = 0.88;
      AMEX_BROWSER_PRODUCT_MATCH_MIN_MARGIN = 0.1;
      PRODUCT_NOISE = /* @__PURE__ */ new Set(["american", "express", "card", "the", "from"]);
      COBRANDS = ["hilton", "delta", "marriott"];
      TIERS = ["gold", "platinum", "reserve", "aspire", "surpass", "brilliant"];
      REVIEWED_SOURCE_ALIASES = {
        "american-express-platinum-card:resy": ["Resy Credit", "Resy Dining Credit", "$400 Resy Credit"],
        "american-express-platinum-card:lululemon": ["lululemon Credit", "$300 lululemon Credit"],
        "american-express-platinum-card:airline-fee": ["$200 Airline Fee Credit", "Airline Fee Credit"],
        "american-express-platinum-card:uber-cash": ["Uber Cash"],
        "american-express-platinum-card:saks": ["Saks Fifth Avenue Credit"],
        "american-express-platinum-card:hotel": ["Hotel Credit"],
        "american-express-platinum-card:digital-entertainment": ["Digital Entertainment Credit"],
        "american-express-platinum-card:walmart-plus": ["Walmart+ Credit"],
        "american-express-business-platinum-card:dell": ["Dell Technologies Credit"],
        "hilton-honors-american-express-aspire-card:hilton-resort": ["Hilton Resort Statement Credit"]
      };
      SOURCE_REQUIRED_TOKEN_OVERRIDES = {
        "american-express-gold-card:dining": [["dining", "grubhub"]],
        "american-express-business-gold-card:flexible-business": [["flexible", "fedex", "grubhub", "office"], ["business", "credit"]],
        "american-express-platinum-card:hotel": [["hotel", "fhr", "thc"]],
        "american-express-business-platinum-card:hotel": [["hotel", "fhr", "thc"]],
        "american-express-business-platinum-card:wireless": [["wireless", "phone"]]
      };
      SOURCE_FORBIDDEN_TOKEN_OVERRIDES = {
        "american-express-platinum-card:airline-fee": [["airline", "bonus"]],
        "american-express-platinum-card:uber-cash": [["uber", "one"], ["membership"]],
        "american-express-platinum-card:uber-one": [["uber", "cash"]],
        "american-express-platinum-card:resy": [["global", "dining", "access"]],
        "hilton-honors-american-express-aspire-card:flight": [["spend"], ["bonus"]]
      };
      BROWSER_AMEX_SOURCE_CREDIT_DESCRIPTORS = (() => {
        const grouped = /* @__PURE__ */ new Map();
        for (const [cardName, product] of Object.entries(AMEX_CATALOG_IDENTITY_REGISTRY)) {
          const card = americanExpressCardCatalog[cardName];
          product.benefits.forEach((identity, index) => {
            if (identity.sourceSemantics !== "usage" || !identity.sourceCreditKey) return;
            const existing = grouped.get(identity.sourceCreditKey) ?? {
              productKey: product.productKey,
              sourceCreditKey: identity.sourceCreditKey,
              creditFamilyKey: identity.sourceCreditKey,
              aliases: /* @__PURE__ */ new Set(),
              periods: /* @__PURE__ */ new Set()
            };
            existing.aliases.add(card.benefits[index].description);
            (REVIEWED_SOURCE_ALIASES[identity.sourceCreditKey] ?? []).forEach((alias) => existing.aliases.add(alias));
            existing.periods.add(identity.periodKey);
            grouped.set(identity.sourceCreditKey, existing);
          });
        }
        return Array.from(grouped.values()).map((descriptor) => ({
          productKey: descriptor.productKey,
          sourceCreditKey: descriptor.sourceCreditKey,
          creditFamilyKey: descriptor.creditFamilyKey,
          exactAliases: Array.from(descriptor.aliases),
          requiredTokenGroups: SOURCE_REQUIRED_TOKEN_OVERRIDES[descriptor.sourceCreditKey] ?? defaultRequiredTokenGroups(descriptor.sourceCreditKey),
          forbiddenTokenGroups: [
            ...GENERIC_FORBIDDEN_AMEX_CREDIT_TOKEN_GROUPS,
            ...SOURCE_FORBIDDEN_TOKEN_OVERRIDES[descriptor.sourceCreditKey] ?? []
          ],
          compatiblePeriodKeys: Array.from(descriptor.periods),
          amountConstraint: {
            currency: "USD",
            minimumUsd: 0,
            ...descriptor.sourceCreditKey === "american-express-platinum-card:uber-cash" ? { maximumUsd: 35 } : {}
          }
        }));
      })();
    }
  });

  // src/lib/amex-benefit-reader/sync-contract.ts
  function assertNoSyncForbiddenFieldNames(value) {
    assertNoForbiddenFieldNames(value);
    const visit = (candidate) => {
      if (Array.isArray(candidate)) return candidate.forEach(visit);
      if (!candidate || typeof candidate !== "object") return;
      for (const [key, child] of Object.entries(candidate)) {
        if (SYNC_FORBIDDEN_FIELD_PATTERN.test(key.replace(/[^a-z]/gi, ""))) {
          throw new Error("Sync input contains a forbidden field name.");
        }
        visit(child);
      }
    };
    visit(value);
  }
  function canonicalJson(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  function parseAmexSyncEnvelope(value) {
    assertNoSyncForbiddenFieldNames(value);
    const envelope = amexSyncEnvelopeSchema.parse(value);
    if (new TextEncoder().encode(canonicalJson(envelope)).byteLength > AMEX_SYNC_MAX_BYTES) {
      throw new Error("Sync input exceeds the byte limit.");
    }
    return envelope;
  }
  async function sha256Hex(value) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function digestAmexSyncEnvelope(envelope) {
    return sha256Hex(canonicalJson(parseAmexSyncEnvelope(envelope)));
  }
  function observedValue(field) {
    return field.state === "observed" && field.value !== void 0 ? field.value : null;
  }
  function projectRow(benefit, match) {
    return {
      providerTitle: benefit.title,
      providerCategory: "usage",
      sourceCreditKey: match.sourceCreditKey,
      creditFamilyKey: match.creditFamilyKey,
      sourcePeriod: observedValue(benefit.sourcePeriod),
      enrollmentState: observedValue(benefit.enrollmentState),
      completionState: observedValue(benefit.completionState),
      earnedOrUsed: observedValue(benefit.earnedOrUsed),
      targetOrLimit: observedValue(benefit.targetOrLimit)
    };
  }
  function projectLatestV3SyncEnvelope(store) {
    const summary = store.lastScan;
    if (!summary?.scanId || summary.status === "interrupted" || summary.status === "failed") {
      return { envelope: null, reason: "fresh_v3_scan_required" };
    }
    const successfulCardIds = new Set(summary.cards.filter((card) => card.result === "complete" && card.localCardId).map((card) => card.localCardId));
    const exclusions = /* @__PURE__ */ new Map();
    const exclude = (reason, count = 1) => {
      exclusions.set(reason, Math.min(AMEX_SYNC_MAX_ROWS, (exclusions.get(reason) ?? 0) + count));
    };
    const cards = [];
    for (const record of Object.values(store.cards)) {
      const latest = record.latest;
      if (!latest) {
        exclude("failed");
        continue;
      }
      if (latest.contractVersion !== OBSERVATION_CONTRACT_VERSION_V3 || latest.parserVersion !== PARSER_VERSION) {
        exclude("v1_only", latest.benefits.length || 1);
        continue;
      }
      if (latest.scanId !== summary.scanId) {
        exclude("older_scan", latest.benefits.length || 1);
        continue;
      }
      if (record.freshness !== "current") {
        exclude(record.freshness === "stale_error" ? "stale" : "failed", latest.benefits.length || 1);
        continue;
      }
      if (record.completeness !== "complete" || latest.completeness !== "complete") {
        exclude("partial", latest.benefits.length || 1);
        continue;
      }
      if (!successfulCardIds.has(record.localCardId)) {
        exclude("not_attempted_successfully", latest.benefits.length || 1);
        continue;
      }
      if (!/^\d{5}$/.test(latest.endingDigits)) {
        exclude("source_last_five_required", latest.benefits.length || 1);
        continue;
      }
      const mapped = latest.benefits.flatMap((benefit) => {
        if (benefit.category.state !== "observed" || benefit.category.value !== "usage") return [];
        const match = matchAmexBrowserSyncCredit(latest.productName, benefit.title, {
          sourcePeriod: benefit.sourcePeriod.state === "observed" ? benefit.sourcePeriod.value : null,
          earnedOrUsed: benefit.earnedOrUsed.state === "observed" ? benefit.earnedOrUsed.value : null
        });
        return match ? [{ benefit, match }] : [];
      });
      const sourceMappingKey = ({
        benefit,
        match
      }) => {
        const period = benefit.sourcePeriod.state === "observed" ? `${benefit.sourcePeriod.value.startDate}|${benefit.sourcePeriod.value.endDate}` : "unstructured";
        return `${match.sourceCreditKey}|${period}`;
      };
      const sourceCounts = /* @__PURE__ */ new Map();
      mapped.forEach((candidate) => {
        const key = sourceMappingKey(candidate);
        sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
      });
      const unambiguous = mapped.filter((candidate) => sourceCounts.get(sourceMappingKey(candidate)) === 1);
      const ambiguousCount = mapped.length - unambiguous.length;
      if (ambiguousCount > 0) exclude("source_mapping_ambiguous", ambiguousCount);
      if (!unambiguous.length) continue;
      cards.push({
        sourceLocalCardId: latest.localCardId,
        providerProductName: latest.productName,
        productKey: amexProductKeySchema.parse(unambiguous[0].match.productKey),
        endingDigits: latest.endingDigits,
        observedAt: latest.observedAt,
        parserVersion: latest.parserVersion,
        rows: unambiguous.map(({ benefit, match }) => projectRow(benefit, match))
      });
    }
    if (!cards.length) return { envelope: null, reason: "no_complete_cards" };
    return {
      reason: "ready",
      envelope: parseAmexSyncEnvelope({
        envelopeVersion: AMEX_SYNC_ENVELOPE_VERSION,
        observationContractVersion: OBSERVATION_CONTRACT_VERSION_V3,
        scanId: summary.scanId,
        scanFinishedAt: summary.finishedAt,
        cards,
        exclusions: Array.from(exclusions, ([reason, count]) => ({ reason, count }))
      })
    };
  }
  var AMEX_SYNC_ENVELOPE_VERSION, AMEX_SYNC_MAX_BYTES, AMEX_SYNC_MAX_CARDS, AMEX_SYNC_MAX_ROWS, AMEX_SYNC_MAX_SCAN_AGE_MS, transportQuantitySchema, syncExclusionReasonSchema, amexSyncRowSchema, amexSyncCardSchema, amexSyncEnvelopeSchema, SYNC_FORBIDDEN_FIELD_PATTERN;
  var init_sync_contract = __esm({
    "src/lib/amex-benefit-reader/sync-contract.ts"() {
      "use strict";
      init_lib();
      init_contract();
      init_supported_card_credits();
      AMEX_SYNC_ENVELOPE_VERSION = "amex-sync-envelope/3";
      AMEX_SYNC_MAX_BYTES = 256 * 1024;
      AMEX_SYNC_MAX_CARDS = 50;
      AMEX_SYNC_MAX_ROWS = 300;
      AMEX_SYNC_MAX_SCAN_AGE_MS = 30 * 60 * 1e3;
      transportQuantitySchema = quantitySchema.refine(
        (quantity) => quantity.value.length <= 32,
        "Quantity value is too long."
      );
      syncExclusionReasonSchema = z.enum([
        "v1_only",
        "older_scan",
        "stale",
        "partial",
        "failed",
        "not_attempted_successfully",
        "no_structured_period",
        "prerequisite_only",
        "status_unavailable",
        "source_mapping_ambiguous",
        "source_last_five_required"
      ]);
      amexSyncRowSchema = z.object({
        providerTitle: z.string().trim().min(1).max(200),
        providerCategory: z.literal("usage"),
        sourceCreditKey: creditFamilyKeySchema,
        creditFamilyKey: creditFamilyKeySchema,
        sourcePeriod: sourcePeriodV2Schema.nullable(),
        enrollmentState: z.enum(["enrolled", "required", "linking_required", "not_required"]).nullable(),
        completionState: z.enum(["complete", "incomplete"]).nullable(),
        earnedOrUsed: transportQuantitySchema.nullable(),
        targetOrLimit: transportQuantitySchema.nullable()
      }).strict();
      amexSyncCardSchema = z.object({
        sourceLocalCardId: z.string().uuid(),
        providerProductName: z.string().trim().min(1).max(200),
        productKey: amexProductKeySchema,
        endingDigits: z.string().regex(/^\d{5}$/),
        observedAt: z.string().datetime({ offset: true }),
        parserVersion: z.literal(PARSER_VERSION),
        rows: z.array(amexSyncRowSchema).max(AMEX_SYNC_MAX_ROWS)
      }).strict();
      amexSyncEnvelopeSchema = z.object({
        envelopeVersion: z.literal(AMEX_SYNC_ENVELOPE_VERSION),
        observationContractVersion: z.literal(OBSERVATION_CONTRACT_VERSION_V3),
        scanId: z.string().uuid(),
        scanFinishedAt: z.string().datetime({ offset: true }),
        cards: z.array(amexSyncCardSchema).min(1).max(AMEX_SYNC_MAX_CARDS),
        exclusions: z.array(z.object({
          reason: syncExclusionReasonSchema,
          count: z.number().int().positive().max(AMEX_SYNC_MAX_ROWS)
        }).strict()).max(syncExclusionReasonSchema.options.length)
      }).strict().superRefine((envelope, context) => {
        const rowCount = envelope.cards.reduce((count, card) => count + card.rows.length, 0);
        if (rowCount > AMEX_SYNC_MAX_ROWS) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["cards"], message: "The sync envelope has too many rows." });
        }
        const cardIds = /* @__PURE__ */ new Set();
        const scanFinishedAt = Date.parse(envelope.scanFinishedAt);
        envelope.cards.forEach((card, index) => {
          if (cardIds.has(card.sourceLocalCardId)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ["cards", index, "sourceLocalCardId"], message: "Source cards must be unique." });
          }
          cardIds.add(card.sourceLocalCardId);
          if (Date.parse(card.observedAt) > scanFinishedAt) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["cards", index, "observedAt"],
              message: "A card observation cannot be newer than its completed scan."
            });
          }
        });
      });
      SYNC_FORBIDDEN_FIELD_PATTERN = /(?:sourcefingerprint|identitysecret|fullcard|cardnumber|accountnumber|accounttoken|opaquetoken|tokenvalue|password|passcode|mfa|cookie|authorization|requestheaders|requestbody|rawrequest|rawresponse|userid|email)/i;
    }
  });

  // src/lib/amex-benefit-reader/sync-mailbox.ts
  function randomOpaqueId() {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function createAmexSyncMailbox(envelopeInput, now = /* @__PURE__ */ new Date()) {
    const envelope = parseAmexSyncEnvelope(envelopeInput);
    const scanDeadline = Date.parse(envelope.scanFinishedAt) + 30 * 60 * 1e3;
    const expiresAt = Math.min(now.getTime() + AMEX_SYNC_MAILBOX_TTL_MS, scanDeadline);
    if (!Number.isFinite(scanDeadline) || expiresAt <= now.getTime()) throw new Error("The reviewed scan has expired.");
    return amexSyncMailboxSchema.parse({
      mailboxVersion: AMEX_SYNC_MAILBOX_VERSION,
      transferId: randomOpaqueId(),
      nonce: randomOpaqueId(),
      createdAt: now.toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      digest: await digestAmexSyncEnvelope(envelope),
      envelope
    });
  }
  function amexSyncHandoffUrl(transferId, targetName = "production") {
    const validated = opaqueIdSchema.parse(transferId);
    const target = resolveAmexSyncHandoffTarget(targetName);
    return `${target.origin}${target.path}?transfer=${validated}`;
  }
  async function storeAmexSyncMailbox(storage2, mailbox, now = /* @__PURE__ */ new Date()) {
    const existingValue = await storage2.getValue(AMEX_SYNC_MAILBOX_KEY, null);
    if (existingValue != null) {
      const existing = amexSyncMailboxSchema.safeParse(existingValue);
      if (existing.success && Date.parse(existing.data.expiresAt) > now.getTime()) {
        throw new Error("A sync handoff is already waiting. Cancel it or wait for it to expire.");
      }
      await storage2.deleteValue(AMEX_SYNC_MAILBOX_KEY);
    }
    if (new TextEncoder().encode(canonicalJson(mailbox)).byteLength > AMEX_SYNC_MAX_BYTES + 2048) {
      throw new Error("The sync mailbox exceeds its byte limit.");
    }
    await storage2.setValue(AMEX_SYNC_MAILBOX_KEY, amexSyncMailboxSchema.parse(mailbox));
  }
  async function loadAmexSyncMailbox(storage2, transferId, now = /* @__PURE__ */ new Date()) {
    const validatedTransferId = opaqueIdSchema.parse(transferId);
    const raw = await storage2.getValue(AMEX_SYNC_MAILBOX_KEY, null);
    const parsed = amexSyncMailboxSchema.safeParse(raw);
    if (!parsed.success || parsed.data.transferId !== validatedTransferId) {
      await storage2.deleteValue(AMEX_SYNC_MAILBOX_KEY);
      throw new Error("The sync handoff is invalid or already consumed.");
    }
    if (Date.parse(parsed.data.expiresAt) <= now.getTime()) {
      await storage2.deleteValue(AMEX_SYNC_MAILBOX_KEY);
      throw new Error("The sync handoff expired.");
    }
    if (Date.parse(parsed.data.createdAt) > now.getTime() + 6e4) {
      await storage2.deleteValue(AMEX_SYNC_MAILBOX_KEY);
      throw new Error("The sync handoff has an invalid creation time.");
    }
    const digest = await digestAmexSyncEnvelope(parsed.data.envelope);
    if (digest !== parsed.data.digest) {
      await storage2.deleteValue(AMEX_SYNC_MAILBOX_KEY);
      throw new Error("The sync handoff failed its integrity check.");
    }
    return parsed.data;
  }
  async function clearAmexSyncMailbox(storage2) {
    await storage2.deleteValue(AMEX_SYNC_MAILBOX_KEY);
  }
  var LEGACY_AMEX_SYNC_MAILBOX_KEY, AMEX_SYNC_MAILBOX_KEY, AMEX_SYNC_MAILBOX_VERSION, AMEX_SYNC_HANDOFF_ORIGIN, AMEX_SYNC_MAILBOX_TTL_MS, opaqueIdSchema, amexSyncMailboxSchema, handoffReadyMessageSchema, handoffPayloadMessageSchema, handoffAcceptedMessageSchema;
  var init_sync_mailbox = __esm({
    "src/lib/amex-benefit-reader/sync-mailbox.ts"() {
      "use strict";
      init_lib();
      init_handoff_target();
      init_sync_contract();
      LEGACY_AMEX_SYNC_MAILBOX_KEY = "perksReminder.amexBenefitReader.syncMailbox.v1";
      AMEX_SYNC_MAILBOX_KEY = "perksReminder.amexBenefitReader.syncMailbox.v2";
      AMEX_SYNC_MAILBOX_VERSION = "amex-sync-mailbox/2";
      AMEX_SYNC_HANDOFF_ORIGIN = PRODUCTION_AMEX_SYNC_HANDOFF_TARGET.origin;
      AMEX_SYNC_MAILBOX_TTL_MS = 10 * 60 * 1e3;
      opaqueIdSchema = z.string().regex(/^[a-f0-9]{32}$/);
      amexSyncMailboxSchema = z.object({
        mailboxVersion: z.literal(AMEX_SYNC_MAILBOX_VERSION),
        transferId: opaqueIdSchema,
        nonce: opaqueIdSchema,
        createdAt: z.string().datetime({ offset: true }),
        expiresAt: z.string().datetime({ offset: true }),
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        envelope: amexSyncEnvelopeSchema
      }).strict().superRefine((mailbox, context) => {
        const createdAt = Date.parse(mailbox.createdAt);
        const expiresAt = Date.parse(mailbox.expiresAt);
        const scanDeadline = Date.parse(mailbox.envelope.scanFinishedAt) + 30 * 60 * 1e3;
        if (expiresAt <= createdAt || expiresAt - createdAt > AMEX_SYNC_MAILBOX_TTL_MS || expiresAt > scanDeadline) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["expiresAt"],
            message: "The sync mailbox expiry is outside its allowed lifetime."
          });
        }
      });
      handoffReadyMessageSchema = z.object({
        type: z.literal("perks-reminder:amex-sync-ready"),
        transferId: opaqueIdSchema
      }).strict();
      handoffPayloadMessageSchema = z.object({
        type: z.literal("perks-reminder:amex-sync-payload"),
        transferId: opaqueIdSchema,
        nonce: opaqueIdSchema,
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        envelope: amexSyncEnvelopeSchema
      }).strict();
      handoffAcceptedMessageSchema = z.object({
        type: z.literal("perks-reminder:amex-sync-accepted"),
        transferId: opaqueIdSchema,
        nonce: opaqueIdSchema
      }).strict();
    }
  });

  // src/lib/amex-benefit-reader/identity.ts
  function utf8Bytes(value) {
    const bytes = [];
    for (const character of value) {
      const point = character.codePointAt(0);
      if (point <= 127) bytes.push(point);
      else if (point <= 2047) bytes.push(192 | point >> 6, 128 | point & 63);
      else if (point <= 65535) bytes.push(224 | point >> 12, 128 | point >> 6 & 63, 128 | point & 63);
      else bytes.push(240 | point >> 18, 128 | point >> 12 & 63, 128 | point >> 6 & 63, 128 | point & 63);
    }
    return new Uint8Array(bytes);
  }
  function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  function hexToBytes(value) {
    if (!/^[a-f0-9]{64}$/i.test(value)) {
      throw new Error("The installation identity secret is invalid.");
    }
    return new Uint8Array(value.match(/.{2}/g).map((pair) => Number.parseInt(pair, 16)));
  }
  function createInstallationSecret(cryptoApi = crypto) {
    const bytes = new Uint8Array(32);
    cryptoApi.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  async function fingerprintCardToken(secret, rawToken, cryptoApi = crypto) {
    if (!rawToken) throw new Error("A stable card token is required.");
    const key = await cryptoApi.subtle.importKey(
      "raw",
      hexToBytes(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await cryptoApi.subtle.sign(
      "HMAC",
      key,
      utf8Bytes(`${CARD_FINGERPRINT_DOMAIN}${rawToken}`)
    );
    return bytesToHex(new Uint8Array(signature));
  }
  function createLocalCardId(cryptoApi = crypto) {
    return cryptoApi.randomUUID();
  }
  function normalizeIdentityText(value) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  }
  function reconcileCardIdentity(input) {
    const records = Object.values(input.records);
    const claimed = input.claimedLocalCardIds ?? /* @__PURE__ */ new Set();
    const exact = records.filter(
      (record) => record.identity.sourceFingerprint === input.sourceFingerprint
    );
    if (exact.length > 1) {
      return { kind: "conflict", reason: "More than one local card has the same source identity." };
    }
    if (exact.length === 1) {
      if (claimed.has(exact[0].localCardId)) {
        return { kind: "conflict", reason: "A source identity appeared more than once in this scan." };
      }
      if (exact[0].identity.endingDigits !== input.endingDigits) {
        return { kind: "conflict", reason: "A source identity changed its displayed card ending." };
      }
      return { kind: "exact", localCardId: exact[0].localCardId, record: exact[0] };
    }
    const displayMatches = records.filter(
      (record) => !claimed.has(record.localCardId) && normalizeIdentityText(record.identity.productName) === normalizeIdentityText(input.productName) && record.identity.endingDigits === input.endingDigits
    );
    if (displayMatches.length > 1) {
      return { kind: "ambiguous", reason: "Multiple local cards share this display identity." };
    }
    if (displayMatches.length === 1) {
      return {
        kind: "reconciled",
        localCardId: displayMatches[0].localCardId,
        record: displayMatches[0]
      };
    }
    return { kind: "new", localCardId: createLocalCardId(input.cryptoApi) };
  }
  function createBenefitKey(input) {
    if (input.hashedDiscriminator && !/^[a-f0-9]{64}$/.test(input.hashedDiscriminator)) {
      throw new Error("A benefit discriminator must already be an approved SHA-256 digest.");
    }
    const value = [
      normalizeIdentityText(input.title),
      normalizeIdentityText(input.category ?? ""),
      input.activityKind,
      input.hashedDiscriminator ?? ""
    ].join("\0");
    let first = 2166136261;
    let second = 2654435769;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619) >>> 0;
      second = Math.imul(second ^ code + index, 2246822507) >>> 0;
    }
    return `benefit-${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
  }
  var CARD_FINGERPRINT_DOMAIN;
  var init_identity = __esm({
    "src/lib/amex-benefit-reader/identity.ts"() {
      "use strict";
      CARD_FINGERPRINT_DOMAIN = "amex-us-card-v1\0";
    }
  });

  // src/lib/amex-benefit-reader/storage-policy.ts
  function fixedErrorMessage(code) {
    return ERROR_MESSAGES[code];
  }
  function createEmptyStore(now) {
    return storeEnvelopeSchema.parse({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      revision: 0,
      updatedAt: now,
      cards: {},
      lastScan: null
    });
  }
  function migrateLegacyRestorationSummary(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const envelope = value;
    const lastScan = envelope.lastScan;
    if (!lastScan || typeof lastScan !== "object" || Array.isArray(lastScan)) return null;
    const legacySummary = lastScan;
    if (!("restoration" in legacySummary) || "visibleContext" in legacySummary) return null;
    if (typeof legacySummary.restoration !== "string") return null;
    const summaryWithoutRestoration = { ...legacySummary };
    delete summaryWithoutRestoration.restoration;
    return parseStoreEnvelope({
      ...envelope,
      lastScan: {
        ...summaryWithoutRestoration,
        status: summaryWithoutRestoration.status === "complete" ? "partial" : summaryWithoutRestoration.status,
        visibleContext: "unavailable"
      }
    });
  }
  function loadStoreValue(value, now) {
    if (value == null) return createEmptyStore(now);
    assertNoForbiddenFieldNames(value);
    if (typeof value === "object" && value && "schemaVersion" in value) {
      const version = value.schemaVersion;
      if (typeof version === "number" && version > STORAGE_SCHEMA_VERSION) {
        throw new Error("Local data uses a newer unsupported schema.");
      }
    }
    try {
      return parseStoreEnvelope(value);
    } catch (error) {
      const migrated = migrateLegacyRestorationSummary(value);
      if (migrated) return migrated;
      throw error;
    }
  }
  function mergeCardAttempt(store, attempt) {
    const existing = store.cards[attempt.identity.localCardId];
    let record;
    if (attempt.disposition === "failed") {
      record = {
        localCardId: attempt.identity.localCardId,
        identity: existing?.latest ? existing.identity : {
          sourceFingerprint: attempt.identity.sourceFingerprint,
          productName: attempt.identity.productName,
          endingDigits: attempt.identity.endingDigits
        },
        latest: existing?.latest ?? null,
        freshness: existing?.latest ? "stale_error" : "error_no_data",
        completeness: "failed",
        observedAt: existing?.observedAt ?? null,
        lastAttemptAt: attempt.attemptedAt,
        error: { code: attempt.errorCode, message: fixedErrorMessage(attempt.errorCode) }
      };
    } else {
      record = {
        localCardId: attempt.identity.localCardId,
        identity: {
          sourceFingerprint: attempt.identity.sourceFingerprint,
          productName: attempt.identity.productName,
          endingDigits: attempt.identity.endingDigits
        },
        latest: attempt.observation,
        freshness: "current",
        completeness: attempt.disposition,
        observedAt: attempt.observation.observedAt,
        lastAttemptAt: attempt.attemptedAt,
        error: null
      };
    }
    const next = parseStoreEnvelope({
      ...store,
      revision: store.revision + 1,
      updatedAt: attempt.attemptedAt,
      cards: { ...store.cards, [record.localCardId]: record }
    });
    return { store: next, record: next.cards[record.localCardId] };
  }
  function mergeScanSummary(store, summary) {
    const validatedSummary = scanSummarySchema.parse(summary);
    return parseStoreEnvelope({
      ...store,
      revision: store.revision + 1,
      updatedAt: validatedSummary.finishedAt,
      lastScan: validatedSummary
    });
  }
  var STORE_KEY, IDENTITY_SECRET_KEY, ERROR_MESSAGES;
  var init_storage_policy = __esm({
    "src/lib/amex-benefit-reader/storage-policy.ts"() {
      "use strict";
      init_contract();
      STORE_KEY = "perksReminder.amexBenefitReader.store.v1";
      IDENTITY_SECRET_KEY = "perksReminder.amexBenefitReader.identitySecret.v1";
      ERROR_MESSAGES = {
        unknown_account_variant: "An unrecognized account response variant was not scanned.",
        duplicate_card_entry: "A physical card identity appeared more than once in account discovery.",
        identity_unavailable: "A stable local card identity could not be created.",
        identity_ambiguous: "This card could not be matched safely to local data.",
        identity_conflict: "Conflicting local card identities were detected.",
        display_reconciled: "The local card display identity changed and was reconciled.",
        response_schema_invalid: "An Amex read response did not match the reviewed structure.",
        unknown_activity_kind: "A benefit activity type was not recognized.",
        unknown_status: "A benefit status was not recognized.",
        unknown_quantity: "A benefit amount or unit was not recognized.",
        benefit_identity_conflict: "Two benefits could not be distinguished safely.",
        request_timeout: "A first-party Amex read request timed out.",
        network_error: "A first-party Amex read request was blocked or could not connect.",
        http_error: "A first-party Amex read request returned an unexpected response.",
        content_type_invalid: "An Amex read response was not JSON.",
        redirect_rejected: "An unexpected redirect was rejected.",
        signed_out: "The signed-in Amex session is no longer available.",
        scan_cancelled: "The scan was cancelled.",
        visible_context_changed: "The visible Amex card or route changed during the API scan.",
        storage_invalid: "Local reader data is malformed or from an unsupported version."
      };
    }
  });

  // src/userscripts/amex-benefit-reader/storage-port.ts
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function invalidateObservations(store, invalidatedAt) {
    if (Object.keys(store.cards).length === 0 && store.lastScan === null) return store;
    return {
      ...store,
      revision: store.revision + 1,
      updatedAt: invalidatedAt,
      cards: {},
      lastScan: null
    };
  }
  function invalidateSelectionIncompleteObservations(store, invalidatedAt) {
    const cards = Object.fromEntries(Object.entries(store.cards).filter(([, record]) => record.latest === null || record.latest.contractVersion === "amex-benefits/3"));
    if (Object.keys(cards).length === Object.keys(store.cards).length && store.lastScan === null) return store;
    return {
      ...store,
      revision: store.revision + 1,
      updatedAt: invalidatedAt,
      cards,
      lastScan: null
    };
  }
  var PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE, V3_SELECTION_COMPATIBILITY_KEY, V3_SELECTION_COMPATIBILITY_VALUE, BrowserResultStore, BrowserMailboxStorage, BrowserCardIdentityService;
  var init_storage_port = __esm({
    "src/userscripts/amex-benefit-reader/storage-port.ts"() {
      "use strict";
      init_identity();
      init_storage_policy();
      init_sync_mailbox();
      PRIMARY_ONLY_COMPATIBILITY_KEY = "perksReminder.amexBenefitReader.compat.primaryOnly.v1";
      PRIMARY_ONLY_COMPATIBILITY_VALUE = "primary-only/1";
      V3_SELECTION_COMPATIBILITY_KEY = "perksReminder.amexBenefitReader.compat.v3Selection.v1";
      V3_SELECTION_COMPATIBILITY_VALUE = "v3-selection/1";
      BrowserResultStore = class {
        constructor(storage2) {
          this.storage = storage2;
        }
        async deletePendingMailboxes() {
          await this.storage.deleteValue(LEGACY_AMEX_SYNC_MAILBOX_KEY);
          await this.storage.deleteValue(AMEX_SYNC_MAILBOX_KEY);
        }
        async load() {
          const migratedAt = nowIso();
          const primaryCompatibility = await this.storage.getValue(PRIMARY_ONLY_COMPATIBILITY_KEY, null);
          const v3Compatibility = await this.storage.getValue(V3_SELECTION_COMPATIBILITY_KEY, null);
          const rawStore = await this.storage.getValue(STORE_KEY, null);
          let loaded = loadStoreValue(rawStore, migratedAt);
          if (primaryCompatibility !== PRIMARY_ONLY_COMPATIBILITY_VALUE) {
            const invalidated = invalidateObservations(loaded, migratedAt);
            await this.deletePendingMailboxes();
            if (invalidated !== loaded) await this.storage.setValue(STORE_KEY, invalidated);
            await this.storage.setValue(PRIMARY_ONLY_COMPATIBILITY_KEY, PRIMARY_ONLY_COMPATIBILITY_VALUE);
            loaded = invalidated;
          }
          if (v3Compatibility !== V3_SELECTION_COMPATIBILITY_VALUE) {
            const invalidated = invalidateSelectionIncompleteObservations(loaded, migratedAt);
            await this.deletePendingMailboxes();
            if (invalidated !== loaded) await this.storage.setValue(STORE_KEY, invalidated);
            await this.storage.setValue(V3_SELECTION_COMPATIBILITY_KEY, V3_SELECTION_COMPATIBILITY_VALUE);
            loaded = invalidated;
          }
          return loaded;
        }
        async commitCard(result) {
          const current = await this.load();
          const merged = mergeCardAttempt(current, result);
          await this.storage.setValue(STORE_KEY, merged.store);
          return merged.record;
        }
        async recordScanSummary(summary) {
          const current = await this.load();
          await this.storage.setValue(STORE_KEY, mergeScanSummary(current, summary));
        }
        async clear() {
          await Promise.all([
            this.storage.deleteValue(STORE_KEY),
            this.storage.deleteValue(IDENTITY_SECRET_KEY),
            this.storage.deleteValue(AMEX_SYNC_MAILBOX_KEY),
            this.storage.deleteValue(LEGACY_AMEX_SYNC_MAILBOX_KEY),
            this.storage.deleteValue(PRIMARY_ONLY_COMPATIBILITY_KEY),
            this.storage.deleteValue(V3_SELECTION_COMPATIBILITY_KEY)
          ]);
        }
        async initializeIfNeeded() {
          const value = await this.storage.getValue(STORE_KEY, null);
          if (value == null) await this.storage.setValue(STORE_KEY, createEmptyStore(nowIso()));
        }
      };
      BrowserMailboxStorage = class {
        constructor(storage2) {
          this.storage = storage2;
        }
        getValue(key, defaultValue) {
          return this.storage.getValue(key, defaultValue);
        }
        setValue(key, value) {
          return this.storage.setValue(key, value);
        }
        deleteValue(key) {
          return this.storage.deleteValue(key);
        }
      };
      BrowserCardIdentityService = class {
        constructor(storage2) {
          this.storage = storage2;
        }
        async loadSecret() {
          const stored = await this.storage.getValue(IDENTITY_SECRET_KEY, null);
          if (typeof stored === "string" && /^[a-f0-9]{64}$/.test(stored)) return stored;
          if (stored != null) throw new Error("The local identity secret is malformed.");
          const secret = createInstallationSecret();
          await this.storage.setValue(IDENTITY_SECRET_KEY, secret);
          return secret;
        }
        async prepareCard(input) {
          const sourceFingerprint = await fingerprintCardToken(await this.loadSecret(), input.rawAccountToken);
          return { sourceFingerprint, productName: input.productName, endingDigits: input.endingDigits };
        }
      };
    }
  });

  // src/userscripts/amex-benefit-reader/tampermonkey-storage.ts
  var TampermonkeyStorage, storage, TampermonkeyResultStore, TampermonkeyMailboxStorage, TampermonkeyCardIdentityService;
  var init_tampermonkey_storage = __esm({
    "src/userscripts/amex-benefit-reader/tampermonkey-storage.ts"() {
      "use strict";
      init_storage_port();
      TampermonkeyStorage = class {
        getValue(key, defaultValue) {
          return GM.getValue(key, defaultValue);
        }
        setValue(key, value) {
          return GM.setValue(key, value);
        }
        deleteValue(key) {
          return GM.deleteValue(key);
        }
      };
      storage = new TampermonkeyStorage();
      TampermonkeyResultStore = class extends BrowserResultStore {
        constructor() {
          super(storage);
        }
      };
      TampermonkeyMailboxStorage = class extends BrowserMailboxStorage {
        constructor() {
          super(storage);
        }
      };
      TampermonkeyCardIdentityService = class extends BrowserCardIdentityService {
        constructor() {
          super(storage);
        }
      };
    }
  });

  // src/lib/amex-benefit-reader/amex-api-contract.ts
  function buildTrackerRequestBody(accountToken) {
    requireTransientAccountToken(accountToken);
    return JSON.stringify([{ accountToken, locale: "en-US", limit: "ALL" }]);
  }
  function buildCatalogRequestBody(accountToken) {
    requireTransientAccountToken(accountToken);
    return JSON.stringify({ accountToken, locale: "en-US" });
  }
  function requireTransientAccountToken(accountToken) {
    if (typeof accountToken !== "string" || accountToken.length === 0 || accountToken.length > 4096) {
      throw new Error("A transient account identity is required.");
    }
  }
  var AMEX_API_TIMEOUT_MS, responseText, accountProductSchema, accountDisplayFields, supplementaryAccountDetailsSchema, topLevelNestedAccountSchema, supplementaryAccountSchema, memberAccountSchema, memberResponseSchema, trackerQuantitySchema, benefitTrackerSchema, trackerResponseSchema, catalogBenefitSchema, catalogResponseSchema, MEMBER_READ_ENDPOINT, TRACKER_READ_ENDPOINT, CATALOG_READ_ENDPOINT;
  var init_amex_api_contract = __esm({
    "src/lib/amex-benefit-reader/amex-api-contract.ts"() {
      "use strict";
      init_lib();
      AMEX_API_TIMEOUT_MS = 15e3;
      responseText = (maxLength) => z.string().max(maxLength).nullish();
      accountProductSchema = z.object({
        description: responseText(160),
        product_description: responseText(160)
      }).strip();
      accountDisplayFields = {
        relationship: responseText(40),
        display_account_number: responseText(100),
        account_number: responseText(100),
        display_number: responseText(100),
        card_number: responseText(100)
      };
      supplementaryAccountDetailsSchema = z.object({
        account_token: responseText(4096),
        product: accountProductSchema.optional(),
        ...accountDisplayFields
      }).strip();
      topLevelNestedAccountSchema = z.object(accountDisplayFields).strip();
      supplementaryAccountSchema = z.object({
        account_token: responseText(4096),
        product: accountProductSchema.optional(),
        ...accountDisplayFields,
        account: supplementaryAccountDetailsSchema.optional()
      }).strip();
      memberAccountSchema = z.object({
        account_token: responseText(4096),
        product: accountProductSchema.optional(),
        ...accountDisplayFields,
        account: topLevelNestedAccountSchema.optional(),
        supplementary_accounts: z.array(supplementaryAccountSchema).optional()
      }).strip();
      memberResponseSchema = z.object({
        accounts: z.array(memberAccountSchema)
      }).strip();
      trackerQuantitySchema = z.object({
        targetAmount: responseText(100),
        spentAmount: responseText(100),
        remainingAmount: responseText(100),
        targetCurrencySymbol: responseText(20),
        targetCurrency: responseText(20),
        targetUnit: responseText(40)
      }).strip();
      benefitTrackerSchema = z.object({
        sorBenefitId: responseText(500),
        benefitId: responseText(500),
        benefitName: responseText(200),
        category: responseText(100),
        status: responseText(100),
        periodStartDate: responseText(70),
        periodEndDate: responseText(70),
        trackerDuration: responseText(160),
        tracker: trackerQuantitySchema.optional()
      }).strip();
      trackerResponseSchema = z.array(z.object({
        trackers: z.array(benefitTrackerSchema)
      }).strip());
      catalogBenefitSchema = z.object({
        sorBenefitId: responseText(500),
        benefitShortTitle: responseText(200),
        benefitTitle: responseText(200),
        benefitName: responseText(200),
        layoutType: responseText(100),
        isEnrollable: z.boolean().nullish()
      }).strip();
      catalogResponseSchema = z.object({
        benefits: z.record(catalogBenefitSchema)
      }).strip();
      MEMBER_READ_ENDPOINT = Object.freeze({
        origin: "https://global.americanexpress.com",
        path: "/api/servicing/v1/member",
        method: "GET",
        headers: Object.freeze({ Accept: "application/json" })
      });
      TRACKER_READ_ENDPOINT = Object.freeze({
        origin: "https://functions.americanexpress.com",
        path: "/ReadBestLoyaltyBenefitsTrackers.v1",
        method: "POST",
        headers: Object.freeze({
          Accept: "*/*",
          "Content-Type": "application/json"
        })
      });
      CATALOG_READ_ENDPOINT = Object.freeze({
        origin: "https://functions.americanexpress.com",
        path: "/ReadLoyaltyBenefits.v2",
        method: "POST",
        headers: Object.freeze({
          Accept: "application/json",
          "Content-Type": "application/json"
        })
      });
    }
  });

  // src/lib/amex-benefit-reader/amex-api-client.ts
  function throwIfCancelled(signal) {
    if (signal.aborted) throw new AmexApiError("scan_cancelled");
  }
  function exactEndpointUrl(endpoint) {
    return `${endpoint.origin}${endpoint.path}`;
  }
  var AmexApiError, AmexApiClient;
  var init_amex_api_client = __esm({
    "src/lib/amex-benefit-reader/amex-api-client.ts"() {
      "use strict";
      init_amex_api_contract();
      AmexApiError = class extends Error {
        constructor(issueCode, retryable = false) {
          super(issueCode);
          this.issueCode = issueCode;
          this.retryable = retryable;
          this.name = "AmexApiError";
        }
      };
      AmexApiClient = class {
        constructor(options = {}) {
          this.fetchImpl = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
          this.timeoutMs = options.timeoutMs ?? AMEX_API_TIMEOUT_MS;
          if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
            throw new Error("The Amex read timeout must be positive.");
          }
        }
        discoverAccounts(signal) {
          return this.executeWithRetry({
            endpoint: MEMBER_READ_ENDPOINT,
            schema: memberResponseSchema
          }, signal);
        }
        async readBenefitTrackers(accountToken, signal) {
          return this.executeWithRetry({
            endpoint: TRACKER_READ_ENDPOINT,
            body: buildTrackerRequestBody(accountToken),
            schema: trackerResponseSchema
          }, signal);
        }
        async readBenefitCatalog(accountToken, signal) {
          return this.executeWithRetry({
            endpoint: CATALOG_READ_ENDPOINT,
            body: buildCatalogRequestBody(accountToken),
            schema: catalogResponseSchema
          }, signal);
        }
        async executeWithRetry(request, signal) {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            throwIfCancelled(signal);
            try {
              return await this.executeOnce(request, signal);
            } catch (error) {
              const classified = this.classifyThrownError(error, signal);
              if (!classified.retryable || attempt === 1) throw classified;
            }
          }
          throw new AmexApiError("network_error");
        }
        async executeOnce(request, signal) {
          const url = exactEndpointUrl(request.endpoint);
          const timeoutController = new AbortController();
          let timedOut = false;
          const forwardAbort = () => timeoutController.abort(signal.reason);
          signal.addEventListener("abort", forwardAbort, { once: true });
          const timer = setTimeout(() => {
            timedOut = true;
            timeoutController.abort();
          }, this.timeoutMs);
          let rawJson;
          try {
            const response = await this.fetchImpl(url, {
              method: request.endpoint.method,
              headers: request.endpoint.headers,
              body: request.body,
              credentials: "include",
              // Manual mode prevents Fetch from following an unknown destination and
              // lets opaque/manual redirects be rejected without a network retry.
              redirect: "manual",
              signal: timeoutController.signal
            });
            if (response.type === "opaqueredirect" || response.redirected || response.url !== url) {
              throw new AmexApiError("redirect_rejected");
            }
            if (response.status === 401 || response.status === 403) {
              throw new AmexApiError("signed_out");
            }
            if (!response.ok) {
              throw new AmexApiError("http_error", response.status >= 500 && response.status <= 599);
            }
            const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
            if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
              throw new AmexApiError("content_type_invalid");
            }
            try {
              rawJson = await response.json();
            } catch {
              if (signal.aborted) throw new AmexApiError("scan_cancelled");
              if (timedOut) throw new AmexApiError("request_timeout");
              throw new AmexApiError("response_schema_invalid");
            }
            const parsed = request.schema.safeParse(rawJson);
            if (!parsed.success) throw new AmexApiError("response_schema_invalid");
            return parsed.data;
          } catch (error) {
            if (signal.aborted) throw new AmexApiError("scan_cancelled");
            if (timedOut) throw new AmexApiError("request_timeout");
            throw error;
          } finally {
            rawJson = void 0;
            clearTimeout(timer);
            signal.removeEventListener("abort", forwardAbort);
          }
        }
        classifyThrownError(error, signal) {
          if (error instanceof AmexApiError) return error;
          if (signal.aborted) return new AmexApiError("scan_cancelled");
          if (error instanceof DOMException && error.name === "AbortError") {
            return new AmexApiError("network_error", true);
          }
          if (error instanceof TypeError) return new AmexApiError("network_error", true);
          return new AmexApiError("network_error", true);
        }
      };
    }
  });

  // src/lib/amex-benefit-reader/amex-response-adapter.ts
  function text(value, maxLength) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized && normalized.length <= maxLength ? normalized : null;
  }
  function uniqueText(values, maxLength) {
    const provided = values.filter((value) => value != null);
    if (provided.length === 0) return { state: "absent" };
    const normalized = provided.map((value) => text(value, maxLength));
    if (normalized.some((value) => value === null)) return { state: "invalid" };
    const unique = new Set(normalized);
    return unique.size === 1 ? { state: "valid", value: Array.from(unique)[0] } : { state: "invalid" };
  }
  function productDescription(product) {
    if (product == null) return { state: "absent" };
    if (typeof product !== "object" || Array.isArray(product)) return { state: "invalid" };
    const candidate = product;
    return uniqueText([candidate.description, candidate.product_description], 160);
  }
  function endingDigitsFromFields(source) {
    const provided = [
      source.display_account_number,
      source.account_number,
      source.display_number,
      source.card_number
    ].filter((value) => value != null);
    if (provided.length === 0) return { state: "absent" };
    if (provided.some((value) => typeof value !== "string")) return { state: "invalid" };
    const endings = provided.map((value) => value.match(VISIBLE_DIGITS)?.join("") ?? "");
    if (endings.some((digits) => digits.length !== 4 && digits.length !== 5)) return { state: "invalid" };
    const unique = new Set(endings);
    return unique.size === 1 ? { state: "valid", value: Array.from(unique)[0] } : { state: "invalid" };
  }
  function resolvedRelationship(...values) {
    const extracted = uniqueText(values, 40);
    return extracted.state === "valid" ? extracted.value.toUpperCase() : null;
  }
  function resolvedLayeredEnding(outer, nested) {
    const outerEnding = endingDigitsFromFields(outer);
    const nestedEnding = nested ? endingDigitsFromFields(nested) : { state: "absent" };
    if (outerEnding.state === "invalid" || nestedEnding.state === "invalid") return null;
    if (outerEnding.state === "valid" && nestedEnding.state === "valid") {
      return outerEnding.value === nestedEnding.value ? outerEnding.value : null;
    }
    return outerEnding.state === "valid" ? outerEnding.value : nestedEnding.state === "valid" ? nestedEnding.value : null;
  }
  function parseAccountDiscovery(response) {
    const cards = [];
    const seenTokens = /* @__PURE__ */ new Set();
    let unknownVariantCount = 0;
    let duplicateCount = 0;
    const addCard = (candidate) => {
      if (!candidate) {
        unknownVariantCount += 1;
        return;
      }
      if (seenTokens.has(candidate.rawAccountToken)) {
        duplicateCount += 1;
        return;
      }
      seenTokens.add(candidate.rawAccountToken);
      cards.push(candidate);
    };
    for (const account of response.accounts) {
      const accountRelationship = resolvedRelationship(
        account.relationship,
        account.account?.relationship
      );
      if (accountRelationship === "BASIC") {
        const rawAccountToken = uniqueText([account.account_token], 4096);
        const productName = productDescription(account.product);
        const endingDigits = resolvedLayeredEnding(account, account.account);
        addCard(rawAccountToken.state === "valid" && productName.state === "valid" && endingDigits ? {
          rawAccountToken: rawAccountToken.value,
          productName: productName.value,
          endingDigits
        } : null);
      } else {
        unknownVariantCount += 1;
      }
      for (const supplementary of account.supplementary_accounts ?? []) {
        const supplementaryRelationship = resolvedRelationship(
          supplementary.account?.relationship,
          supplementary.relationship
        );
        if (supplementaryRelationship === "SUPP") {
          continue;
        }
        unknownVariantCount += 1;
      }
    }
    const issueCodes = [];
    if (unknownVariantCount) issueCodes.push("unknown_account_variant");
    if (duplicateCount) issueCodes.push("duplicate_card_entry");
    return {
      cards,
      knownNonCardCount: 0,
      unknownVariantCount: unknownVariantCount + duplicateCount,
      issueCodes
    };
  }
  function notExposed() {
    return { state: "not_exposed" };
  }
  function unrecognized(issueCode) {
    return { state: "unrecognized", issueCode };
  }
  function observed(value) {
    return { state: "observed", value };
  }
  function exactString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  function quantityUnit(tracker) {
    const currency = exactString(tracker?.targetCurrency)?.toUpperCase() ?? null;
    const unit = exactString(tracker?.targetUnit)?.toUpperCase() ?? null;
    if (unit === "MONETARY" && currency === "USD") {
      return { unit: "USD", currency: "USD", recognized: true };
    }
    if (unit === "PASSES" && currency === null) {
      return { unit: "count", currency: null, recognized: true };
    }
    return { unit: "unknown", currency: null, recognized: false };
  }
  function quantityField(value, tracker, issues) {
    if (value == null) return notExposed();
    if (typeof value !== "string" || !DECIMAL.test(value)) {
      issues.add("unknown_quantity");
      return unrecognized("unknown_quantity");
    }
    const unit = quantityUnit(tracker);
    if (!unit.recognized) issues.add("unknown_quantity");
    return observed({ value, unit: unit.unit, currency: unit.currency });
  }
  function periodField(tracker) {
    const duration = text(tracker.trackerDuration, 160);
    if (duration) return observed(duration);
    const start = text(tracker.periodStartDate, 70);
    const end = text(tracker.periodEndDate, 70);
    if (start && end) return observed(`${start} to ${end}`);
    if (start || end) return observed(start ?? end);
    if (tracker.trackerDuration != null || tracker.periodStartDate != null || tracker.periodEndDate != null) {
      return unrecognized("unknown_status");
    }
    return notExposed();
  }
  function sourcePeriodField(tracker) {
    const start = tracker.periodStartDate;
    const end = tracker.periodEndDate;
    if (start == null && end == null) return notExposed();
    if (typeof start !== "string" || typeof end !== "string") return unrecognized("unknown_status");
    const parsed = sourcePeriodV2Schema.safeParse({
      kind: "calendar_date_range",
      startDate: start,
      endDate: end,
      timeZone: "UTC"
    });
    return parsed.success ? observed(parsed.data) : unrecognized("unknown_status");
  }
  function trackerStatusFields(statusValue, activityKind, issues) {
    if (statusValue == null) {
      return { trackerState: notExposed(), completionState: notExposed() };
    }
    const status = exactString(statusValue)?.toUpperCase();
    if (status === "ACHIEVED") {
      return { trackerState: observed("completed"), completionState: observed("complete") };
    }
    if (status === "IN_PROGRESS") {
      return { trackerState: observed("in_progress"), completionState: observed("incomplete") };
    }
    if (status === "ACTIVE") {
      return {
        trackerState: observed(activityKind === "credit_earned" ? "earned" : "in_progress"),
        completionState: observed("incomplete")
      };
    }
    issues.add("unknown_status");
    return {
      trackerState: unrecognized("unknown_status"),
      completionState: unrecognized("unknown_status")
    };
  }
  function enrollmentField(catalog, issues) {
    if (!catalog) return notExposed();
    const layout = exactString(catalog.layoutType)?.toUpperCase();
    if (layout === "ENROLLED") return observed("enrolled");
    if (layout === "NOTENROLLED") {
      return catalog.isEnrollable === true ? observed("required") : notExposed();
    }
    if (layout === "LOGGEDIN" || layout === "SUPP") return notExposed();
    if (catalog.layoutType == null && catalog.isEnrollable == null) return notExposed();
    issues.add("unknown_status");
    return unrecognized("unknown_status");
  }
  function catalogTitle(catalog) {
    return text(catalog.benefitShortTitle, 200) ?? text(catalog.benefitTitle, 200) ?? text(catalog.benefitName, 200);
  }
  function isIgnoredCatalogBenefit(catalog) {
    return [catalog.benefitShortTitle, catalog.benefitTitle, catalog.benefitName].some((candidate) => {
      const title = text(candidate, 200);
      return title !== null && isIgnoredAmexCatalogBenefitTitle(title);
    });
  }
  function creditFamily(creditKey) {
    return creditKey.slice(creditKey.lastIndexOf(":") + 1);
  }
  function diagnosticField(field) {
    if (field.state === "observed") return { state: "observed", value: field.value };
    return { state: field.state };
  }
  function catalogLayoutField(catalog) {
    if (catalog.layoutType == null) return { state: "not_exposed" };
    const layout = exactString(catalog.layoutType)?.toUpperCase();
    if (layout === "ENROLLED" || layout === "NOTENROLLED" || layout === "LOGGEDIN" || layout === "SUPP") {
      return { state: "observed", value: layout };
    }
    return { state: "unrecognized" };
  }
  function catalogEnrollableField(catalog) {
    return typeof catalog.isEnrollable === "boolean" ? { state: "observed", value: catalog.isEnrollable } : { state: "not_exposed" };
  }
  function benefitKey(title, category, activityKind) {
    return createBenefitKey({
      title,
      category: category.state === "observed" ? category.value : void 0,
      activityKind
    });
  }
  function sameCatalogObservation(left, right) {
    return exactString(left.sorBenefitId) === exactString(right.sorBenefitId) && exactString(left.benefitShortTitle) === exactString(right.benefitShortTitle) && exactString(left.benefitTitle) === exactString(right.benefitTitle) && exactString(left.benefitName) === exactString(right.benefitName) && exactString(left.layoutType) === exactString(right.layoutType) && left.isEnrollable === right.isEnrollable;
  }
  function orderedConflictDiagnostics(diagnostics) {
    return BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS.filter((diagnostic) => diagnostics.has(diagnostic));
  }
  function candidateSafeValue(candidate) {
    const safe = { ...candidate };
    delete safe.joinId;
    return safe;
  }
  function candidateSignature(candidate) {
    return JSON.stringify(candidateSafeValue(candidate));
  }
  function compareCandidates(left, right) {
    return CONFLICT_SOURCE_ORDER[left.sourceRole] - CONFLICT_SOURCE_ORDER[right.sourceRole] || (left.supportedCreditKey ?? "").localeCompare(right.supportedCreditKey ?? "") || (left.displayTitle ?? "").localeCompare(right.displayTitle ?? "") || candidateSignature(left).localeCompare(candidateSignature(right));
  }
  function sameSet(left, right) {
    return left.size === right.size && Array.from(left).every((item) => right.has(item));
  }
  function candidateFieldRelation(candidates, selectors) {
    if (candidates.length < 2) return "unavailable";
    let hasCompleteComparison = false;
    let hasIncompleteEvidence = false;
    for (const select of selectors) {
      const fields = candidates.map(select);
      const observedValues = fields.flatMap((field) => field.state === "observed" ? [field.value] : []);
      if (observedValues.length >= 2) {
        const serialized = observedValues.map((value) => JSON.stringify(value));
        if (new Set(serialized).size > 1) return "different";
      }
      if (observedValues.length === candidates.length) hasCompleteComparison = true;
      else if (observedValues.length > 0) hasIncompleteEvidence = true;
    }
    if (hasIncompleteEvidence) return "unavailable";
    return hasCompleteComparison ? "same" : "unavailable";
  }
  function stateRelation(candidates) {
    return candidateFieldRelation(candidates, [
      (candidate) => candidate.activityKind,
      (candidate) => candidate.enrollmentState,
      (candidate) => candidate.trackerState,
      (candidate) => candidate.completionState
    ]);
  }
  function amountRelation(candidates) {
    return candidateFieldRelation(candidates, [
      (candidate) => candidate.earnedOrUsed,
      (candidate) => candidate.targetOrLimit,
      (candidate) => candidate.remaining
    ]);
  }
  function v3TrackerDiagnosticCandidate(benefit) {
    return {
      sourceRole: "tracker",
      displayTitle: benefit.title,
      supportedCreditKey: null,
      supportedCreditFamily: null,
      category: diagnosticField(benefit.category),
      activityKind: { state: "observed", value: benefit.activityKind },
      enrollmentState: diagnosticField(benefit.enrollmentState),
      trackerState: diagnosticField(benefit.trackerState),
      completionState: diagnosticField(benefit.completionState),
      earnedOrUsed: diagnosticField(benefit.earnedOrUsed),
      targetOrLimit: diagnosticField(benefit.targetOrLimit),
      remaining: diagnosticField(benefit.remaining),
      period: diagnosticField(benefit.period),
      catalogLayout: { state: "not_exposed" },
      catalogEnrollable: { state: "not_exposed" },
      joinId: null
    };
  }
  function v3CatalogDiagnosticCandidate(catalog) {
    return {
      sourceRole: "joined_catalog",
      displayTitle: catalogTitle(catalog),
      supportedCreditKey: null,
      supportedCreditFamily: null,
      category: { state: "not_exposed" },
      activityKind: { state: "not_exposed" },
      enrollmentState: { state: "not_exposed" },
      trackerState: { state: "not_exposed" },
      completionState: { state: "not_exposed" },
      earnedOrUsed: { state: "not_exposed" },
      targetOrLimit: { state: "not_exposed" },
      remaining: { state: "not_exposed" },
      period: { state: "not_exposed" },
      catalogLayout: catalogLayoutField(catalog),
      catalogEnrollable: catalogEnrollableField(catalog),
      joinId: null
    };
  }
  function sameV3Observation(left, right) {
    return JSON.stringify({ ...left, title: void 0, benefitKey: void 0 }) === JSON.stringify({ ...right, title: void 0, benefitKey: void 0 });
  }
  function normalizeBenefits(input) {
    const issues = /* @__PURE__ */ new Set();
    const conflictDiagnostics = /* @__PURE__ */ new Set();
    const conflictDetailCollector = new ConflictDetailCollector();
    const selectedCatalogs = Object.values(input.catalogResponse.benefits).filter((catalog) => !isIgnoredCatalogBenefit(catalog));
    const catalogsByIssuerId = /* @__PURE__ */ new Map();
    for (const catalog of selectedCatalogs) {
      const issuerId = exactString(catalog.sorBenefitId);
      if (!issuerId) continue;
      const group = catalogsByIssuerId.get(issuerId) ?? [];
      if (!group.some((existing) => sameCatalogObservation(existing, catalog))) group.push(catalog);
      catalogsByIssuerId.set(issuerId, group);
    }
    const normalized = /* @__PURE__ */ new Map();
    for (const block of input.trackerResponse) {
      for (const tracker of block.trackers) {
        const normalizedCategory = exactString(tracker.category)?.toLocaleLowerCase("en-US") ?? null;
        if (normalizedCategory !== "usage") continue;
        const title = text(tracker.benefitName, 200);
        if (!title || !isEligibleLocalAmexUsageTitle(title)) continue;
        const itemIssues = /* @__PURE__ */ new Set();
        const issuerId = exactString(tracker.sorBenefitId);
        const catalogGroup = issuerId ? catalogsByIssuerId.get(issuerId) ?? [] : [];
        const ambiguousCatalog = catalogGroup.length > 1;
        if (ambiguousCatalog) {
          itemIssues.add("benefit_identity_conflict");
          issues.add("benefit_identity_conflict");
          conflictDiagnostics.add("ambiguous_catalog_join");
        }
        const category = observed("usage");
        const activityKind = exactString(tracker.status)?.toUpperCase() === "ACHIEVED" ? "completed" : "credit_usage";
        const statusFields = trackerStatusFields(tracker.status, activityKind, itemIssues);
        const period = periodField(tracker);
        if (period.state === "unrecognized") itemIssues.add(period.issueCode);
        const sourcePeriod = sourcePeriodField(tracker);
        if (sourcePeriod.state === "unrecognized") itemIssues.add(sourcePeriod.issueCode);
        const benefit = normalizedBenefitObservationV3Schema.parse({
          benefitKey: benefitKey(title, category, "credit_usage"),
          sourcePeriod,
          title,
          category,
          activityKind,
          enrollmentState: enrollmentField(ambiguousCatalog ? void 0 : catalogGroup[0], itemIssues),
          trackerState: statusFields.trackerState,
          completionState: statusFields.completionState,
          earnedOrUsed: quantityField(tracker.tracker?.spentAmount, tracker.tracker, itemIssues),
          targetOrLimit: quantityField(tracker.tracker?.targetAmount, tracker.tracker, itemIssues),
          remaining: quantityField(tracker.tracker?.remainingAmount, tracker.tracker, itemIssues),
          period,
          confidence: itemIssues.size === 0 ? "high" : "medium",
          issueCodes: Array.from(itemIssues).sort()
        });
        if (ambiguousCatalog) {
          conflictDetailCollector.add("ambiguous_catalog_join", [
            v3TrackerDiagnosticCandidate(benefit),
            ...catalogGroup.map(v3CatalogDiagnosticCandidate)
          ]);
        }
        const existing = normalized.get(benefit.benefitKey);
        if (!existing) {
          normalized.set(benefit.benefitKey, benefit);
        } else {
          if (!sameV3Observation(existing, benefit)) {
            issues.add("benefit_identity_conflict");
            conflictDiagnostics.add("tracker_state_collision");
            conflictDetailCollector.add("tracker_state_collision", [
              v3TrackerDiagnosticCandidate(existing),
              v3TrackerDiagnosticCandidate(benefit)
            ]);
          }
          if (JSON.stringify(benefit) < JSON.stringify(existing)) {
            normalized.set(benefit.benefitKey, benefit);
          }
        }
        itemIssues.forEach((issue) => issues.add(issue));
      }
    }
    return {
      benefits: Array.from(normalized.values()).sort((left, right) => left.title.localeCompare(right.title) || left.benefitKey.localeCompare(right.benefitKey)),
      issueCodes: Array.from(issues).sort(),
      conflictDiagnostics: orderedConflictDiagnostics(conflictDiagnostics),
      conflictDetails: conflictDetailCollector.finish(/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map())
    };
  }
  var BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS, BENEFIT_IDENTITY_CONFLICT_DETAIL_LIMIT, BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT, BENEFIT_IDENTITY_CONFLICT_TOTAL_LIMIT, DECIMAL, VISIBLE_DIGITS, CONFLICT_SOURCE_ORDER, ConflictDetailCollector;
  var init_amex_response_adapter = __esm({
    "src/lib/amex-benefit-reader/amex-response-adapter.ts"() {
      "use strict";
      init_contract();
      init_identity();
      init_supported_card_credits();
      BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS = [
        "tracker_state_collision",
        "tracker_catalog_key_mismatch",
        "ambiguous_catalog_join",
        "tracker_catalog_candidate_collision"
      ];
      BENEFIT_IDENTITY_CONFLICT_DETAIL_LIMIT = 24;
      BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT = 4;
      BENEFIT_IDENTITY_CONFLICT_TOTAL_LIMIT = 100;
      DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
      VISIBLE_DIGITS = /\d/g;
      CONFLICT_SOURCE_ORDER = {
        tracker: 0,
        joined_catalog: 1,
        catalog_enrollment_candidate: 2
      };
      ConflictDetailCollector = class {
        constructor() {
          this.drafts = [];
        }
        add(category, candidates, explicitCreditKeys = []) {
          const uniqueCandidates = new Map(candidates.map((candidate) => [candidateSignature(candidate), candidate]));
          const reviewedCreditKeys = /* @__PURE__ */ new Set([
            ...explicitCreditKeys,
            ...candidates.flatMap((candidate) => candidate.supportedCreditKey ? [candidate.supportedCreditKey] : [])
          ]);
          const candidateSignatures = new Set(uniqueCandidates.keys());
          const existing = this.drafts.find((draft) => draft.category === category && sameSet(draft.reviewedCreditKeys, reviewedCreditKeys) && Array.from(candidateSignatures).some((signature) => draft.candidates.has(signature)));
          if (existing) {
            uniqueCandidates.forEach((candidate, signature) => existing.candidates.set(signature, candidate));
            return;
          }
          this.drafts.push({ category, reviewedCreditKeys, candidates: uniqueCandidates });
        }
        finish(candidatesByCreditKey, joinIdEvidenceByCreditKey) {
          const categoryOrder = new Map(BENEFIT_IDENTITY_CONFLICT_DIAGNOSTICS.map((category, index) => [category, index]));
          const drafts = [...this.drafts].sort((left, right) => {
            const leftKeys = Array.from(left.reviewedCreditKeys).sort().join("|");
            const rightKeys = Array.from(right.reviewedCreditKeys).sort().join("|");
            const leftCandidates = Array.from(left.candidates.values()).sort(compareCandidates).map(candidateSignature).join("|");
            const rightCandidates = Array.from(right.candidates.values()).sort(compareCandidates).map(candidateSignature).join("|");
            return (categoryOrder.get(left.category) ?? 0) - (categoryOrder.get(right.category) ?? 0) || leftKeys.localeCompare(rightKeys) || leftCandidates.localeCompare(rightCandidates);
          });
          const limitedTotal = Math.min(drafts.length, BENEFIT_IDENTITY_CONFLICT_TOTAL_LIMIT);
          const detailOrdinals = /* @__PURE__ */ new Map();
          const details = drafts.slice(0, BENEFIT_IDENTITY_CONFLICT_DETAIL_LIMIT).map((draft) => {
            const reviewedCreditKeys = Array.from(draft.reviewedCreditKeys).sort().slice(0, BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT);
            const reviewedCreditFamilies = Array.from(new Set(reviewedCreditKeys.map(creditFamily))).sort();
            const ordinalKey = `${draft.category}:${reviewedCreditFamilies.join("+") || "unresolved"}`;
            const ordinal = (detailOrdinals.get(ordinalKey) ?? 0) + 1;
            detailOrdinals.set(ordinalKey, ordinal);
            const allCandidateMap = new Map(draft.candidates);
            const contextualRoles = draft.category === "tracker_state_collision" ? /* @__PURE__ */ new Set(["tracker"]) : draft.category === "tracker_catalog_candidate_collision" ? /* @__PURE__ */ new Set(["tracker", "catalog_enrollment_candidate"]) : null;
            if (contextualRoles) {
              reviewedCreditKeys.forEach((key) => {
                candidatesByCreditKey.get(key)?.forEach((candidate, signature) => {
                  if (contextualRoles.has(candidate.sourceRole)) allCandidateMap.set(signature, candidate);
                });
              });
            }
            const allCandidates = Array.from(allCandidateMap.values()).sort(compareCandidates);
            const candidates = allCandidates.slice(0, BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT);
            const directJoinIds = allCandidates.flatMap((candidate) => candidate.joinId === null ? [] : [candidate.joinId]);
            const contextualJoinEvidence = allCandidates.flatMap((candidate) => {
              if (!candidate.supportedCreditKey) return [];
              const evidence = joinIdEvidenceByCreditKey.get(candidate.supportedCreditKey)?.get(candidateSignature(candidate));
              return evidence ? [evidence] : [];
            });
            const joinIds = /* @__PURE__ */ new Set([
              ...directJoinIds,
              ...contextualJoinEvidence.flatMap((evidence) => Array.from(evidence.ids))
            ]);
            const sameJoinId = allCandidates.length < 2 || allCandidates.some((candidate) => candidate.joinId === null) || contextualJoinEvidence.some((evidence) => evidence.unavailable) ? "unavailable" : joinIds.size === 1 ? "same" : "different";
            return {
              conflictKey: `${ordinalKey}:${String(ordinal).padStart(2, "0")}`,
              category: draft.category,
              reviewedCreditKeys,
              reviewedCreditFamilies,
              candidateCount: Math.min(allCandidates.length, BENEFIT_IDENTITY_CONFLICT_TOTAL_LIMIT),
              candidatesTruncated: allCandidates.length > BENEFIT_IDENTITY_CONFLICT_CANDIDATE_LIMIT,
              candidates: candidates.map((candidate, index) => ({
                candidateIndex: index + 1,
                ...candidateSafeValue(candidate)
              })),
              relations: {
                sameJoinId,
                period: candidateFieldRelation(allCandidates, [(candidate) => candidate.period]),
                amount: amountRelation(allCandidates),
                state: stateRelation(allCandidates)
              }
            };
          });
          return {
            details,
            totalCount: limitedTotal,
            truncated: drafts.length > BENEFIT_IDENTITY_CONFLICT_DETAIL_LIMIT
          };
        }
      };
    }
  });

  // src/lib/amex-benefit-reader/scan-engine.ts
  function throwIfAborted(signal) {
    if (signal.aborted) throw new AmexApiError("scan_cancelled");
  }
  function issueFromError(error) {
    if (error instanceof AmexApiError) return error.issueCode;
    return "response_schema_invalid";
  }
  function createScanId() {
    if (!globalThis.crypto?.getRandomValues) throw new Error("Secure random scan identity is unavailable.");
    if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = bytes[6] & 15 | 64;
    bytes[8] = bytes[8] & 63 | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  var CATALOG_PARTIAL_ISSUES, AmexBenefitScanEngine;
  var init_scan_engine = __esm({
    "src/lib/amex-benefit-reader/scan-engine.ts"() {
      "use strict";
      init_amex_api_client();
      init_amex_response_adapter();
      init_contract();
      init_identity();
      CATALOG_PARTIAL_ISSUES = /* @__PURE__ */ new Set([
        "response_schema_invalid",
        "request_timeout",
        "network_error",
        "http_error",
        "content_type_invalid",
        "redirect_rejected"
      ]);
      AmexBenefitScanEngine = class {
        constructor(client, visibleContext, store, identity, reporter, clock = { now: () => /* @__PURE__ */ new Date() }) {
          this.client = client;
          this.visibleContext = visibleContext;
          this.store = store;
          this.identity = identity;
          this.reporter = reporter;
          this.clock = clock;
          this.activeController = null;
        }
        get isScanning() {
          return this.activeController !== null;
        }
        cancel() {
          this.activeController?.abort();
        }
        async scanAllCards() {
          if (this.activeController) throw new Error("A scan is already active in this tab.");
          const controller = new AbortController();
          this.activeController = controller;
          const signal = controller.signal;
          const startedAt = this.clock.now().toISOString();
          const scanId = createScanId();
          const dispositions = [];
          let capturedContext = null;
          let discovery = null;
          let attemptedCardCount = 0;
          let discoveredCardCount = 0;
          let unknownAccountVariantCount = 0;
          let interrupted = false;
          let discoveryFailed = false;
          let retainedUnseenCard = false;
          let visibleContextResult = "unavailable";
          this.reporter.report({ type: "started" });
          try {
            try {
              capturedContext = this.visibleContext.capture();
            } catch {
              capturedContext = null;
            }
            throwIfAborted(signal);
            const initialStore = await this.store.load();
            await this.store.recordScanSummary({
              scanId,
              startedAt,
              finishedAt: this.clock.now().toISOString(),
              status: "interrupted",
              discoveredCardCount: 0,
              attemptedCardCount: 0,
              unknownAccountVariantCount: 0,
              cards: [],
              visibleContext: "unavailable"
            });
            let memberResponse = await this.client.discoverAccounts(signal);
            try {
              discovery = parseAccountDiscovery(memberResponse);
            } finally {
              memberResponse = null;
            }
            discoveredCardCount = discovery.cards.length;
            unknownAccountVariantCount = discovery.unknownVariantCount;
            this.reporter.report({
              type: "discovered",
              cardCount: discoveredCardCount,
              unknownEntryCount: unknownAccountVariantCount
            });
            const claimed = /* @__PURE__ */ new Set();
            await this.recordInterruptionCheckpoint(scanId, startedAt, discovery, attemptedCardCount, dispositions);
            for (let index = 0; index < discovery.cards.length; index += 1) {
              throwIfAborted(signal);
              const transientCard = discovery.cards[index];
              let rawAccountToken = transientCard.rawAccountToken;
              transientCard.rawAccountToken = "";
              attemptedCardCount += 1;
              let prepared;
              try {
                prepared = await this.identity.prepareCard({
                  rawAccountToken,
                  productName: transientCard.productName,
                  endingDigits: transientCard.endingDigits
                });
              } catch {
                rawAccountToken = "";
                dispositions.push({ localCardId: null, result: "failed", issueCode: "identity_unavailable" });
                await this.recordInterruptionCheckpoint(scanId, startedAt, discovery, attemptedCardCount, dispositions);
                continue;
              }
              const resolution = reconcileCardIdentity({
                sourceFingerprint: prepared.sourceFingerprint,
                productName: prepared.productName,
                endingDigits: prepared.endingDigits,
                records: initialStore.cards,
                claimedLocalCardIds: claimed
              });
              if (resolution.kind === "ambiguous" || resolution.kind === "conflict") {
                rawAccountToken = "";
                dispositions.push({
                  localCardId: null,
                  result: "failed",
                  issueCode: resolution.kind === "ambiguous" ? "identity_ambiguous" : "identity_conflict"
                });
                await this.recordInterruptionCheckpoint(scanId, startedAt, discovery, attemptedCardCount, dispositions);
                continue;
              }
              const localCardId = resolution.localCardId;
              claimed.add(localCardId);
              const identity = {
                localCardId,
                sourceFingerprint: prepared.sourceFingerprint,
                productName: prepared.productName,
                endingDigits: prepared.endingDigits
              };
              let trackerResponse = null;
              let catalogResponse = null;
              let catalogIssueCode = null;
              try {
                this.reporter.report({
                  type: "card",
                  cardIndex: index + 1,
                  cardCount: discovery.cards.length,
                  productName: prepared.productName,
                  endingDigits: prepared.endingDigits,
                  phase: "trackers"
                });
                trackerResponse = await this.client.readBenefitTrackers(rawAccountToken, signal);
                throwIfAborted(signal);
                this.reporter.report({
                  type: "card",
                  cardIndex: index + 1,
                  cardCount: discovery.cards.length,
                  productName: prepared.productName,
                  endingDigits: prepared.endingDigits,
                  phase: "catalog"
                });
                try {
                  catalogResponse = await this.client.readBenefitCatalog(rawAccountToken, signal);
                } catch (error) {
                  const code = issueFromError(error);
                  if (!CATALOG_PARTIAL_ISSUES.has(code)) throw error;
                  catalogIssueCode = code;
                  catalogResponse = { benefits: {} };
                }
                throwIfAborted(signal);
                this.reporter.report({
                  type: "card",
                  cardIndex: index + 1,
                  cardCount: discovery.cards.length,
                  productName: prepared.productName,
                  endingDigits: prepared.endingDigits,
                  phase: "normalizing"
                });
                const normalized = normalizeBenefits({
                  productName: prepared.productName,
                  trackerResponse,
                  catalogResponse
                });
                const issueCodes = Array.from(/* @__PURE__ */ new Set([
                  ...normalized.issueCodes,
                  ...catalogIssueCode ? [catalogIssueCode] : [],
                  ...resolution.kind === "reconciled" ? ["display_reconciled"] : []
                ]));
                const disposition = issueCodes.length ? "partial" : "complete";
                const observedAt = this.clock.now().toISOString();
                const observation = {
                  contractVersion: OBSERVATION_CONTRACT_VERSION_V3,
                  issuer: "american_express_us",
                  localCardId,
                  productName: prepared.productName,
                  endingDigits: prepared.endingDigits,
                  observedAt,
                  parserVersion: PARSER_VERSION,
                  scanId,
                  completeness: disposition,
                  issueCodes,
                  benefits: normalized.benefits
                };
                const record = await this.store.commitCard({
                  disposition,
                  identity,
                  attemptedAt: observedAt,
                  observation
                });
                this.reporter.report({
                  type: "card_committed",
                  record,
                  conflictDiagnostics: normalized.conflictDiagnostics,
                  conflictDetails: normalized.conflictDetails
                });
                dispositions.push({ localCardId, result: disposition, issueCode: issueCodes[0] ?? null });
              } catch (error) {
                const code = issueFromError(error);
                if (code === "scan_cancelled") {
                  interrupted = true;
                  throw error;
                }
                const attemptedAt = this.clock.now().toISOString();
                const record = await this.store.commitCard({
                  disposition: "failed",
                  identity,
                  attemptedAt,
                  errorCode: code
                });
                this.reporter.report({ type: "card_committed", record, conflictDiagnostics: [], conflictDetails: { details: [], totalCount: 0, truncated: false } });
                dispositions.push({ localCardId, result: "failed", issueCode: code });
              } finally {
                trackerResponse = null;
                catalogResponse = null;
                rawAccountToken = "";
              }
              await this.recordInterruptionCheckpoint(scanId, startedAt, discovery, attemptedCardCount, dispositions);
            }
            for (const record of Object.values(initialStore.cards)) {
              if (claimed.has(record.localCardId)) continue;
              retainedUnseenCard = true;
              const attemptedAt = this.clock.now().toISOString();
              const staleRecord = await this.store.commitCard({
                disposition: "failed",
                identity: {
                  localCardId: record.localCardId,
                  sourceFingerprint: record.identity.sourceFingerprint,
                  productName: record.identity.productName,
                  endingDigits: record.identity.endingDigits
                },
                attemptedAt,
                errorCode: "identity_ambiguous"
              });
              this.reporter.report({ type: "card_committed", record: staleRecord, conflictDiagnostics: [], conflictDetails: { details: [], totalCount: 0, truncated: false } });
            }
          } catch (error) {
            const code = issueFromError(error);
            if (code === "scan_cancelled") interrupted = true;
            else {
              discoveryFailed = discovery === null;
              if (discoveryFailed) dispositions.push({ localCardId: null, result: "failed", issueCode: code });
            }
          } finally {
            discovery?.cards.forEach((card) => {
              card.rawAccountToken = "";
            });
            discovery = null;
            this.reporter.report({ type: "verifying_context" });
            if (capturedContext) {
              try {
                visibleContextResult = this.visibleContext.verifyUnchanged(capturedContext) ? "unchanged" : "changed";
              } catch {
                visibleContextResult = "unavailable";
              }
            }
          }
          const hasFailure = dispositions.some((item) => item.result === "failed");
          const hasPartial = dispositions.some((item) => item.result === "partial");
          const noSuccessfulCards = discoveredCardCount > 0 && !dispositions.some((item) => item.result === "complete" || item.result === "partial");
          const status = interrupted ? "interrupted" : discoveryFailed || discoveredCardCount === 0 || noSuccessfulCards ? "failed" : hasFailure || hasPartial || retainedUnseenCard || unknownAccountVariantCount > 0 || visibleContextResult !== "unchanged" ? "partial" : "complete";
          const summary = {
            scanId,
            startedAt,
            finishedAt: this.clock.now().toISOString(),
            status,
            discoveredCardCount,
            attemptedCardCount,
            unknownAccountVariantCount,
            cards: dispositions,
            visibleContext: visibleContextResult
          };
          try {
            await this.store.recordScanSummary(summary);
            this.reporter.report({ type: "finished", summary });
            return summary;
          } finally {
            this.activeController = null;
          }
        }
        async recordInterruptionCheckpoint(scanId, startedAt, discovery, attemptedCardCount, cards) {
          await this.store.recordScanSummary({
            scanId,
            startedAt,
            finishedAt: this.clock.now().toISOString(),
            status: "interrupted",
            discoveredCardCount: discovery.cards.length,
            attemptedCardCount,
            unknownAccountVariantCount: discovery.unknownVariantCount,
            cards: [...cards],
            visibleContext: "unavailable"
          });
        }
      };
    }
  });

  // src/userscripts/amex-benefit-reader/provider-text.ts
  function isUnicodeScalarValue(value) {
    return Number.isInteger(value) && value > 0 && value <= 1114111 && (value < 55296 || value > 57343);
  }
  function decodeNumericCharacterReferences(value) {
    return value.replace(
      NUMERIC_CHARACTER_REFERENCE,
      (reference, decimalDigits, hexadecimalDigits) => {
        const digits = decimalDigits ?? hexadecimalDigits;
        if (!digits) return reference;
        const codePoint = Number.parseInt(digits, decimalDigits ? 10 : 16);
        return isUnicodeScalarValue(codePoint) ? String.fromCodePoint(codePoint) : reference;
      }
    );
  }
  function formatAmexBenefitTitle(value) {
    const decoded = decodeNumericCharacterReferences(value).trimEnd();
    for (const marker of AMEX_SUPERSCRIPT_FOOTNOTE_MARKERS) {
      const markerBeforeStatementCredit = `${marker}${STATEMENT_CREDIT_SUFFIX}`;
      if (decoded.endsWith(markerBeforeStatementCredit)) {
        const prefix = decoded.slice(0, -markerBeforeStatementCredit.length).trimEnd();
        return prefix ? `${prefix}${STATEMENT_CREDIT_SUFFIX}` : STATEMENT_CREDIT_SUFFIX.trimStart();
      }
    }
    for (const marker of AMEX_SUPERSCRIPT_FOOTNOTE_MARKERS) {
      if (decoded.endsWith(marker)) {
        const withoutTerminalFootnote = decoded.slice(0, -marker.length).trimEnd();
        return withoutTerminalFootnote || decoded;
      }
    }
    if (decoded.endsWith("‡")) {
      const withoutStandaloneDagger = decoded.slice(0, -1).trimEnd();
      return withoutStandaloneDagger || decoded;
    }
    return decoded;
  }
  var NUMERIC_CHARACTER_REFERENCE, AMEX_SUPERSCRIPT_FOOTNOTE_MARKERS, STATEMENT_CREDIT_SUFFIX;
  var init_provider_text = __esm({
    "src/userscripts/amex-benefit-reader/provider-text.ts"() {
      "use strict";
      NUMERIC_CHARACTER_REFERENCE = /&#(?:([0-9]+)|[xX]([0-9a-fA-F]+));/g;
      AMEX_SUPERSCRIPT_FOOTNOTE_MARKERS = ["<sup>‡</sup>", "<sup>®</sup>"];
      STATEMENT_CREDIT_SUFFIX = " Statement Credit";
    }
  });

  // src/userscripts/amex-benefit-reader/panel.ts
  function element(tag, text2) {
    const result = document.createElement(tag);
    if (text2 != null) result.textContent = text2;
    return result;
  }
  function calendarDateParts(value) {
    const [year, month, day] = value.split("-").map(Number);
    return { year, month, day };
  }
  function lastDayOfMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  function compactExplicitDateRange(start, end) {
    const startMonth = COMPACT_MONTHS[start.month - 1];
    const endMonth = COMPACT_MONTHS[end.month - 1];
    if (start.year === end.year && start.month === end.month) {
      return `${startMonth} ${start.day}–${end.day}, ${start.year}`;
    }
    if (start.year === end.year) {
      return `${startMonth} ${start.day}–${endMonth} ${end.day}, ${start.year}`;
    }
    return `${startMonth} ${start.day}, ${start.year}–${endMonth} ${end.day}, ${end.year}`;
  }
  function formatAmexSourcePeriod(period) {
    const start = calendarDateParts(period.startDate);
    const end = calendarDateParts(period.endDate);
    const startsOnMonthBoundary = start.day === 1;
    const endsOnMonthBoundary = end.day === lastDayOfMonth(end.year, end.month);
    if (startsOnMonthBoundary && endsOnMonthBoundary && start.year === end.year) {
      if (start.month === 1 && end.month === 12) return String(start.year);
      if (start.month === end.month) return `${COMPACT_MONTHS[start.month - 1]} ${start.year}`;
      return `${COMPACT_MONTHS[start.month - 1]}–${COMPACT_MONTHS[end.month - 1]} ${start.year}`;
    }
    return compactExplicitDateRange(start, end);
  }
  function quantityText(quantity) {
    if (quantity.unit === "USD") return `$${quantity.value}`;
    if (quantity.unit === "percent") return `${quantity.value}%`;
    if (quantity.unit === "points") return `${quantity.value} points`;
    if (quantity.unit === "count") return `${quantity.value} count`;
    return quantity.value;
  }
  function observedValue2(field) {
    return field.state === "observed" ? field.value : null;
  }
  function quantitiesAreCompatible(left, right) {
    return left.unit !== "unknown" && right.unit !== "unknown" && left.unit === right.unit && left.currency === right.currency;
  }
  function nonnegativeDecimalParts(value) {
    const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
    if (!match) return null;
    return {
      integer: match[1].replace(/^0+(?=\d)/, ""),
      fraction: (match[2] ?? "").replace(/0+$/, "")
    };
  }
  function compareNonnegativeDecimals(left, right) {
    const leftParts = nonnegativeDecimalParts(left);
    const rightParts = nonnegativeDecimalParts(right);
    if (!leftParts || !rightParts) return null;
    if (leftParts.integer.length !== rightParts.integer.length) {
      return leftParts.integer.length < rightParts.integer.length ? -1 : 1;
    }
    if (leftParts.integer !== rightParts.integer) return leftParts.integer < rightParts.integer ? -1 : 1;
    const fractionLength = Math.max(leftParts.fraction.length, rightParts.fraction.length);
    const leftFraction = leftParts.fraction.padEnd(fractionLength, "0");
    const rightFraction = rightParts.fraction.padEnd(fractionLength, "0");
    if (leftFraction === rightFraction) return 0;
    return leftFraction < rightFraction ? -1 : 1;
  }
  function compareUsageToPositiveTarget(current, target) {
    if (!current || !target || !quantitiesAreCompatible(current, target)) return null;
    const targetVsZero = compareNonnegativeDecimals(target.value, "0");
    if (targetVsZero !== 1) return null;
    return compareNonnegativeDecimals(current.value, target.value);
  }
  function isObservedZero(quantity) {
    return quantity !== null && compareNonnegativeDecimals(quantity.value, "0") === 0;
  }
  function deriveBenefitUsageState(benefit) {
    const completion = observedValue2(benefit.completionState);
    const tracker = observedValue2(benefit.trackerState);
    const enrollment = observedValue2(benefit.enrollmentState);
    const current = observedValue2(benefit.earnedOrUsed);
    const target = observedValue2(benefit.targetOrLimit);
    const quantityComparison = compareUsageToPositiveTarget(current, target);
    if (enrollment === "required") return { label: "Enrollment required", tone: "amber", filter: "remaining" };
    if (enrollment === "linking_required") return { label: "Link required", tone: "amber", filter: "remaining" };
    if (completion === "complete" || tracker === "earned" || tracker === "completed" || benefit.activityKind === "credit_earned" || benefit.activityKind === "completed" || quantityComparison === 0 || quantityComparison === 1) {
      return { label: "Used", tone: "green", filter: "used" };
    }
    if (quantityComparison === -1 && isObservedZero(current)) {
      return { label: "Not used", tone: "amber", filter: "remaining" };
    }
    if (tracker === "in_progress" || quantityComparison === -1) {
      return { label: "Partially used", tone: "blue", filter: "remaining" };
    }
    if (tracker === "not_started") {
      return { label: "Not used", tone: "amber", filter: "remaining" };
    }
    return { label: "Status unavailable", tone: "muted", filter: "remaining" };
  }
  function benefitPeriodText(benefit) {
    if ("sourcePeriod" in benefit) {
      const sourcePeriod = observedValue2(benefit.sourcePeriod);
      if (sourcePeriod) return formatAmexSourcePeriod(sourcePeriod);
    }
    return observedValue2(benefit.period);
  }
  function benefitPresentation(benefit) {
    const state = deriveBenefitUsageState(benefit);
    const current = observedValue2(benefit.earnedOrUsed);
    const target = observedValue2(benefit.targetOrLimit);
    let amount = null;
    if (current && target && quantitiesAreCompatible(current, target)) {
      amount = `${quantityText(current)} of ${quantityText(target)}`;
    } else if (current && !target && current.unit !== "unknown") {
      amount = `Used ${quantityText(current)}`;
    } else if (!current && target && target.unit !== "unknown") {
      amount = `Total ${quantityText(target)}`;
    }
    return {
      ...state,
      amount,
      period: benefitPeriodText(benefit)
    };
  }
  function sortedCards(store) {
    return Object.values(store.cards).sort((left, right) => left.identity.productName.localeCompare(right.identity.productName) || left.identity.endingDigits.localeCompare(right.identity.endingDigits));
  }
  function isConfirmedEmptyInLatestScan(record, summary, dispositions) {
    const cardDispositions = dispositions.filter((card) => card.localCardId === record.localCardId);
    if (cardDispositions.length !== 1 || cardDispositions[0].result !== "complete") return false;
    if (!record.latest || record.latest.benefits.length !== 0 || record.freshness !== "current" || record.completeness !== "complete" || record.latest.completeness !== "complete") return false;
    return record.latest.contractVersion === "amex-benefits/1" || summary.scanId === void 0 || record.latest.scanId === summary.scanId;
  }
  function projectCardCoverage(store) {
    const cards = sortedCards(store);
    const summary = store.lastScan;
    const latestCardIds = new Set(summary?.cards.flatMap((card) => card.localCardId ? [card.localCardId] : []) ?? []);
    return cards.map((record) => {
      if (!summary || !latestCardIds.has(record.localCardId)) return { record, kind: "older_retained" };
      if ((record.latest?.benefits.length ?? 0) > 0) return { record, kind: "benefit_bearing" };
      if (isConfirmedEmptyInLatestScan(record, summary, summary.cards)) return { record, kind: "confirmed_empty" };
      return { record, kind: "latest_scan_unresolved" };
    });
  }
  function filterLabel(filter) {
    return filter === "remaining" ? "Remaining" : "Used";
  }
  var AMEX_READER_HOST_ID, PERKS_REMINDER_MARK_SVG, COMPACT_MONTHS, AmexBenefitReaderPanel;
  var init_panel = __esm({
    "src/userscripts/amex-benefit-reader/panel.ts"() {
      "use strict";
      init_provider_text();
      AMEX_READER_HOST_ID = "perks-reminder-amex-reader";
      PERKS_REMINDER_MARK_SVG = `<svg viewBox="0 0 40 40" role="img" aria-label="Perks Reminder" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="12" fill="#172033"/><path d="M11 20a9 9 0 0 1 15.2-6.5M29 20a9 9 0 0 1-15.2 6.5" fill="none" stroke="#8fe3c1" stroke-width="3" stroke-linecap="round"/><path d="m25 10 2 4-4 1M15 30l-2-4 4-1" fill="none" stroke="#ffcf70" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      COMPACT_MONTHS = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ];
      AmexBenefitReaderPanel = class _AmexBenefitReaderPanel {
        constructor(initialStore, actions, options = {}) {
          this.actions = actions;
          this.mode = "idle";
          this.progress = "Ready to scan.";
          this.progressCardCount = null;
          this.progressCardIndex = 0;
          this.errorMessage = null;
          this.benefitFilter = "remaining";
          this.store = initialStore;
          this.collapsed = options.initiallyCollapsed ?? false;
          this.requiresReloadAfterClear = options.requiresReloadAfterClear ?? false;
          this.host = document.createElement("div");
          this.host.id = AMEX_READER_HOST_ID;
          this.root = this.host.attachShadow({ mode: "open" });
          document.documentElement.append(this.host);
          this.render();
        }
        static mountError(message, clearData, options = {}) {
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const empty = { schemaVersion: 1, revision: 0, updatedAt: now, cards: {}, lastScan: null };
          const panel = new _AmexBenefitReaderPanel(empty, {
            startScan: async () => void 0,
            cancelScan: () => void 0,
            syncReviewed: async () => void 0,
            clearData
          }, { ...options, requiresReloadAfterClear: true });
          panel.mode = "error";
          panel.errorMessage = message;
          panel.render();
          return panel;
        }
        report(progress) {
          if (progress.type === "started") {
            this.collapsed = false;
            this.mode = "scanning";
            this.progressCardCount = null;
            this.progressCardIndex = 0;
            this.progress = "Starting your read-only scan…";
          } else if (progress.type === "discovered") {
            this.progressCardCount = progress.cardCount;
            this.progressCardIndex = 0;
            this.progress = progress.cardCount === 0 ? "No eligible cards were found. Finishing the scan…" : `Preparing ${progress.cardCount} card${progress.cardCount === 1 ? "" : "s"} for a read-only scan…`;
          } else if (progress.type === "card") {
            this.progressCardCount = progress.cardCount;
            this.progressCardIndex = progress.cardIndex;
            this.progress = `Reading card ${progress.cardIndex} of ${progress.cardCount}…`;
          } else if (progress.type === "card_committed") {
            this.store = { ...this.store, cards: { ...this.store.cards, [progress.record.localCardId]: progress.record } };
          } else if (progress.type === "verifying_context") {
            if (this.progressCardCount !== null) this.progressCardIndex = this.progressCardCount;
            this.progress = "Finishing the scan…";
          } else {
            this.mode = "idle";
            this.progressCardCount = null;
            this.progressCardIndex = 0;
            this.store = { ...this.store, lastScan: progress.summary };
            this.progress = "Ready to scan.";
          }
          this.render();
        }
        async start() {
          if (this.mode !== "idle") return;
          this.collapsed = false;
          this.mode = "scanning";
          this.progressCardCount = null;
          this.progressCardIndex = 0;
          this.progress = "Starting your read-only scan…";
          this.errorMessage = null;
          this.render();
          try {
            await this.actions.startScan();
          } catch {
            this.mode = "error";
            this.errorMessage = "The scan could not finish safely. Existing local observations were preserved.";
            this.render();
          }
        }
        cancel() {
          if (this.mode !== "scanning") return;
          this.mode = "cancelling";
          this.progress = "Cancelling after the current safe step…";
          this.actions.cancelScan();
          this.render();
        }
        async syncReviewed() {
          if (this.mode !== "idle" || !this.store.lastScan || !this.actions.syncReviewed) return;
          this.mode = "syncing";
          this.errorMessage = null;
          this.progress = "Preparing a private one-time handoff…";
          this.render();
          try {
            await this.actions.syncReviewed();
            this.progress = "Sync review opened in a new tab. Confirm separately there; nothing is written from Amex.";
          } catch (error) {
            this.errorMessage = error instanceof Error ? error.message : "A sync handoff could not be prepared.";
            this.progress = "No data was sent and no benefit was changed.";
          } finally {
            this.mode = "idle";
            this.render();
          }
        }
        async clear() {
          if (!window.confirm("Clear all local Amex benefit observations and the local identity secret?")) return;
          try {
            await this.actions.clearData();
            this.store = { schemaVersion: 1, revision: 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), cards: {}, lastScan: null };
            this.benefitFilter = "remaining";
            this.mode = this.requiresReloadAfterClear ? "error" : "idle";
            this.errorMessage = this.requiresReloadAfterClear ? "Local data was cleared. Reload this Amex page before scanning." : null;
            this.progress = this.requiresReloadAfterClear ? "Local data cleared. Reload required." : "Local data cleared. Nothing is scanned until you start.";
          } catch {
            this.mode = "error";
            this.errorMessage = "Local data could not be cleared. No scan was started.";
          }
          this.render();
        }
        renderBenefit(benefit) {
          const presentation = benefitPresentation(benefit);
          const item = element("li");
          item.className = `benefit-card tone-${presentation.tone}`;
          item.dataset.filter = presentation.filter;
          const top = element("div");
          top.className = "benefit-top";
          const heading = element("h4", formatAmexBenefitTitle(benefit.title));
          const badge = element("span", presentation.label);
          badge.className = `status-pill tone-${presentation.tone}`;
          top.append(heading, badge);
          item.append(top);
          const essentials = element("div");
          essentials.className = "benefit-essentials";
          if (presentation.amount) {
            const amount = element("span", presentation.amount);
            amount.className = "amount";
            essentials.append(amount);
          }
          if (presentation.period) {
            const period = element("span", presentation.period);
            period.className = "period";
            essentials.append(period);
          }
          if (essentials.childElementCount) item.append(essentials);
          return item;
        }
        renderCardGroup(record) {
          const section = element("section");
          const headingId = `pr-card-${record.localCardId}`;
          const benefits = record.latest?.benefits ?? [];
          const filtered = benefits.filter((benefit) => benefitPresentation(benefit).filter === this.benefitFilter);
          section.className = "card-group";
          section.dataset.amexReaderCardGroup = "true";
          section.dataset.cardProduct = record.identity.productName;
          section.dataset.cardEnding = record.identity.endingDigits;
          const headingRow = element("div");
          headingRow.className = "card-heading";
          const headingCopy = element("div");
          const heading = element("h3", `${record.identity.productName} •••• ${record.identity.endingDigits}`);
          heading.id = headingId;
          headingCopy.append(heading);
          const visibleLabel = filterLabel(this.benefitFilter).toLowerCase();
          const summaryId = `${headingId}-summary`;
          const summary = element(
            "p",
            `${filtered.length} ${visibleLabel} benefit${filtered.length === 1 ? "" : "s"}`
          );
          summary.id = summaryId;
          summary.className = "card-summary";
          headingCopy.append(summary);
          section.setAttribute("aria-labelledby", `${headingId} ${summaryId}`);
          headingRow.append(headingCopy);
          section.append(headingRow);
          const list = element("ul");
          list.className = "benefit-list";
          filtered.forEach((benefit) => list.append(this.renderBenefit(benefit)));
          section.append(list);
          return section;
        }
        render() {
          this.root.replaceChildren();
          const style = element("style");
          style.textContent = `
      :host { all: initial; --pr-bg: #f8fafc; --pr-card: #ffffff; --pr-text: #1f2937; --pr-muted: #667085; --pr-control: #475467; --pr-amount: #111827; --pr-muted-surface: #f8fafc; --pr-muted-surface-text: #667085; --pr-filter-active-bg: #eef2f6; --pr-filter-active-text: #1f2937; --pr-empty-border: #cbd5e1; --pr-border: #e4e7ec; --pr-primary: #27313d; --pr-primary-hover: #1f2933; --pr-amber: #d97706; --pr-amber-bg: #fffbeb; --pr-amber-border: #fde68a; --pr-blue: #2563eb; --pr-blue-bg: #eff6ff; --pr-blue-border: #bfdbfe; --pr-green: #059669; --pr-green-bg: #ecfdf5; --pr-green-border: #a7f3d0; --pr-red: #dc2626; --pr-red-bg: #fef2f2; --pr-red-border: #fecaca; }
      * { box-sizing: border-box; }
      .launcher { position: fixed; z-index: 2147483647; top: 16px; right: 16px; display: grid; width: 52px; min-height: 52px; padding: 7px; place-items: center; border: 1px solid #475467; border-radius: 16px; background: var(--pr-primary); color: #fff; box-shadow: 0 8px 24px rgba(15,23,42,.2); }
      .launcher:hover { background: var(--pr-primary-hover); }
      .launcher svg { width: 36px; height: 36px; }
      .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
      .panel { position: fixed; z-index: 2147483647; top: 16px; right: 16px; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; border: 1px solid var(--pr-border); border-radius: 20px; background: var(--pr-bg); color: var(--pr-text); box-shadow: 0 18px 50px rgba(15,23,42,.18); font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      h2,h3,h4,p { margin: 0; } h2 { font-size: 19px; line-height: 1.2; } h3 { font-size: 16px; line-height: 1.3; } h4 { font-size: 14px; line-height: 1.35; } ul { margin: 0; }
      .top { padding: 18px; border-bottom: 1px solid var(--pr-border); background: var(--pr-card); border-radius: 16px 16px 0 0; }
      .brand-row { display: flex; align-items: center; gap: 10px; }
      .brand-mark { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 12px; background: var(--pr-primary); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .04em; overflow: hidden; }
      .brand-mark svg { width: 34px; height: 34px; }
      .collapse-button { min-height: 34px; margin-left: auto; padding: 6px 9px; color: var(--pr-control); font-size: 12px; }
      .eyebrow { margin-top: 2px; color: var(--pr-muted); font-size: 12px; }
      .privacy-banner { margin-top: 14px; padding: 10px 12px; border: 1px solid #dbeafe; border-radius: 10px; background: #f0f7ff; color: #334155; font-size: 12px; }
      .privacy-banner strong { display: block; margin-bottom: 2px; color: #1e3a5f; font-size: 13px; }
      .controls { display: flex; gap: 8px; margin-top: 14px; }
      button { min-height: 40px; border-radius: 9px; font: inherit; }
      button { border: 1px solid var(--pr-border); background: var(--pr-card); color: var(--pr-text); font-weight: 650; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease; }
      button:active { transform: translateY(1px); }
      button.primary { flex: 1; border-color: var(--pr-primary); background: var(--pr-primary); color: #fff; box-shadow: 0 2px 5px rgba(15,23,42,.12); }
      button.primary:hover { background: var(--pr-primary-hover); }
      button:focus-visible, summary:focus-visible { outline: 3px solid rgba(71,85,105,.28); outline-offset: 2px; }
      button:disabled { opacity: .52; cursor: default; transform: none; }
      .scan-workspace { display: grid; gap: 14px; padding: 22px 18px; }
      .scan-status { padding: 10px 12px; border: 1px solid var(--pr-border); border-radius: 10px; background: var(--pr-muted-surface); color: var(--pr-muted-surface-text); font-size: 13px; }
      .scan-progress { width: 100%; height: 10px; accent-color: var(--pr-primary); }
      .scan-cancel { width: 100%; }
      .notice { margin-top: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px; }
      .notice-warning { border: 1px solid var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .content { padding: 16px; }
      .card-groups { display: grid; gap: 12px; margin-top: 14px; }
      .card-group { padding: 14px; border: 1px solid var(--pr-border); border-radius: 14px; background: var(--pr-card); box-shadow: 0 1px 2px rgba(15,23,42,.04); }
      .card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .card-summary { margin-top: 4px; color: var(--pr-muted); font-size: 12px; }
      .status-pill { display: inline-flex; align-items: center; flex: 0 0 auto; border: 1px solid; border-radius: 999px; font-size: 11px; font-weight: 750; white-space: nowrap; padding: 3px 7px; }
      .filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
      .filter-button { min-height: 40px; padding: 7px 10px; color: var(--pr-control); font-size: 13px; }
      .filter-button[aria-pressed="true"] { border-color: #94a3b8; background: var(--pr-filter-active-bg); color: var(--pr-filter-active-text); box-shadow: inset 0 0 0 1px rgba(71,85,105,.08); }
      .benefit-list { display: grid; gap: 10px; padding: 0; margin-top: 12px; list-style: none; }
      .benefit-card { position: relative; overflow: hidden; padding: 13px 13px 12px 16px; border: 1px solid var(--pr-border); border-radius: 11px; background: var(--pr-card); box-shadow: 0 1px 2px rgba(15,23,42,.04); }
      .benefit-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: #94a3b8; }
      .benefit-card.tone-amber::before { background: #f59e0b; } .benefit-card.tone-blue::before { background: #3b82f6; } .benefit-card.tone-green::before { background: #10b981; }
      .benefit-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
      .status-pill { padding: 3px 7px; }
      .status-pill.tone-amber { border-color: var(--pr-amber-border); background: var(--pr-amber-bg); color: #92400e; }
      .status-pill.tone-blue { border-color: var(--pr-blue-border); background: var(--pr-blue-bg); color: #1d4ed8; }
      .status-pill.tone-green { border-color: var(--pr-green-border); background: var(--pr-green-bg); color: #047857; }
      .status-pill.tone-muted { border-color: var(--pr-border); background: var(--pr-muted-surface); color: var(--pr-muted-surface-text); }
      .benefit-essentials { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; margin-top: 7px; }
      .amount { color: var(--pr-amount); font-size: 13px; font-weight: 750; font-variant-numeric: tabular-nums; }
      .period { color: var(--pr-muted); font-size: 12px; }
      details { margin-top: 10px; }
      summary { color: var(--pr-control); font-size: 12px; font-weight: 700; cursor: pointer; }
      .empty-state { margin-top: 12px; padding: 18px 12px; border: 1px dashed var(--pr-empty-border); border-radius: 10px; color: var(--pr-muted); text-align: center; }
      .footer { padding: 0 16px 16px; }
      .privacy-details p { margin-top: 8px; color: var(--pr-muted); font-size: 12px; }
      .clear-button { width: 100%; margin-top: 10px; padding: 8px 10px; border-color: var(--pr-red-border); color: #b91c1c; }
      @media (prefers-color-scheme: dark) { :host { --pr-bg:#111827; --pr-card:#1f2937; --pr-text:#f8fafc; --pr-muted:#cbd5e1; --pr-control:#e2e8f0; --pr-amount:#f8fafc; --pr-muted-surface:#172033; --pr-muted-surface-text:#cbd5e1; --pr-filter-active-bg:#374151; --pr-filter-active-text:#f8fafc; --pr-empty-border:#4b5563; --pr-border:#374151; --pr-primary:#0f766e; --pr-primary-hover:#115e59; } .privacy-banner { background:#172554; color:#dbeafe; border-color:#1d4ed8; } .privacy-banner strong { color:#fef3c7; } }
      @media (max-width: 520px) { .panel { top: 8px; right: 8px; width: calc(100vw - 16px); max-height: calc(100vh - 16px); } }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    `;
          if (this.collapsed) {
            const launcher = element("button");
            launcher.type = "button";
            launcher.className = "launcher";
            launcher.setAttribute("aria-label", "Open Perks Reminder Amex benefit reader");
            launcher.setAttribute("aria-expanded", "false");
            launcher.setAttribute("aria-controls", "pr-reader-panel");
            launcher.innerHTML = PERKS_REMINDER_MARK_SVG;
            launcher.append(element("span", "PR"));
            launcher.lastElementChild.className = "sr-only";
            launcher.addEventListener("click", () => {
              this.collapsed = false;
              this.render();
            });
            this.root.append(style, launcher);
            return;
          }
          const panel = element("section");
          panel.id = "pr-reader-panel";
          panel.className = "panel";
          panel.setAttribute("aria-labelledby", "pr-reader-title");
          if (this.mode === "scanning" || this.mode === "cancelling") {
            const workspace = element("section");
            workspace.className = "scan-workspace";
            const title2 = element("h2", "Amex benefits");
            title2.id = "pr-reader-title";
            workspace.append(title2);
            const status = element("p", this.progress);
            status.className = "scan-status";
            status.setAttribute("role", "status");
            status.setAttribute("aria-live", "polite");
            workspace.append(status);
            const progress = element("progress");
            progress.className = "scan-progress";
            progress.setAttribute("aria-label", "Scan progress");
            if (this.progressCardCount !== null && this.progressCardCount > 0) {
              progress.max = this.progressCardCount;
              progress.value = Math.min(this.progressCardIndex, this.progressCardCount);
              progress.setAttribute("aria-valuetext", `Card ${this.progressCardIndex} of ${this.progressCardCount}`);
            }
            workspace.append(progress);
            const cancel = element("button", this.mode === "cancelling" ? "Cancelling…" : "Cancel");
            cancel.type = "button";
            cancel.className = "scan-cancel";
            cancel.disabled = this.mode === "cancelling";
            cancel.addEventListener("click", () => this.cancel());
            workspace.append(cancel);
            panel.append(workspace);
            this.root.append(style, panel);
            return;
          }
          const top = element("div");
          top.className = "top";
          const brand = element("div");
          brand.className = "brand-row";
          const brandMark = element("div");
          brandMark.className = "brand-mark";
          brandMark.setAttribute("aria-hidden", "true");
          brandMark.innerHTML = PERKS_REMINDER_MARK_SVG;
          brand.append(brandMark);
          const brandText = element("div");
          const title = element("h2", "Amex benefits");
          title.id = "pr-reader-title";
          brandText.append(title, element("p", "Perks Reminder local reader"));
          brandText.lastElementChild.className = "eyebrow";
          brand.append(brandText);
          if (this.mode === "idle" || this.mode === "syncing" || this.mode === "error") {
            const collapse = element("button", "Collapse");
            collapse.type = "button";
            collapse.className = "collapse-button";
            collapse.setAttribute("aria-label", "Collapse Perks Reminder Amex benefit reader");
            collapse.setAttribute("aria-expanded", "true");
            collapse.setAttribute("aria-controls", "pr-reader-panel");
            collapse.addEventListener("click", () => {
              this.collapsed = true;
              this.render();
            });
            brand.append(collapse);
          }
          top.append(brand);
          const disclosure = element("div");
          disclosure.className = "privacy-banner";
          disclosure.append(
            element("strong", "Local unless you choose Sync reviewed"),
            element("span", "A manual scan uses your signed-in Amex session for first-party read requests. Raw responses are not saved. Sync sends only the reviewed normalized handoff.")
          );
          top.append(disclosure);
          const controls = element("div");
          controls.className = "controls";
          const scan = element("button", "Scan all cards");
          scan.type = "button";
          scan.className = "primary";
          scan.disabled = this.mode !== "idle";
          scan.addEventListener("click", () => void this.start());
          controls.append(scan);
          if (this.store.lastScan && this.actions.syncReviewed) {
            const sync = element("button", "Sync reviewed");
            sync.type = "button";
            sync.dataset.amexSyncAction = "true";
            sync.disabled = this.mode !== "idle";
            sync.addEventListener("click", () => void this.syncReviewed());
            controls.append(sync);
          }
          top.append(controls);
          if (this.errorMessage) {
            const error = element("p", this.errorMessage);
            error.className = "notice notice-warning";
            error.setAttribute("role", "alert");
            top.append(error);
          }
          panel.append(top);
          const coverage = projectCardCoverage(this.store);
          const cards = coverage.map(({ record }) => record);
          const benefitCards = cards.filter((record) => (record.latest?.benefits.length ?? 0) > 0);
          const confirmedEmptyCards = coverage.filter(({ kind }) => kind === "confirmed_empty");
          const reviewEntries = coverage.filter(({ kind }) => kind !== "confirmed_empty");
          const filterCounts = { remaining: 0, used: 0 };
          benefitCards.forEach((record) => {
            record.latest?.benefits.forEach((benefit) => {
              filterCounts[benefitPresentation(benefit).filter] += 1;
            });
          });
          const renderedEntries = reviewEntries.filter(({ record }) => record.latest?.benefits.some((benefit) => benefitPresentation(benefit).filter === this.benefitFilter));
          const content = element("div");
          content.className = "content";
          if (cards.length) {
            const totalBenefits = filterCounts.remaining + filterCounts.used;
            if (benefitCards.length) {
              const filters = element("div");
              filters.className = "filters";
              filters.setAttribute("role", "group");
              filters.setAttribute("aria-label", "Filter account benefits");
              ["remaining", "used"].forEach((filter) => {
                const control = element("button", `${filterLabel(filter)} ${filterCounts[filter]}`);
                control.type = "button";
                control.className = "filter-button";
                control.dataset.filter = filter;
                control.setAttribute("aria-pressed", String(this.benefitFilter === filter));
                control.addEventListener("click", () => {
                  this.benefitFilter = filter;
                  this.render();
                });
                filters.append(control);
              });
              content.append(filters);
            }
            if (renderedEntries.length) {
              const groups = element("div");
              groups.className = "card-groups";
              renderedEntries.forEach(({ record }) => groups.append(this.renderCardGroup(record)));
              content.append(groups);
            } else {
              let message;
              const allCardsConclusivelyEmpty = totalBenefits === 0 && confirmedEmptyCards.length === cards.length && this.store.lastScan?.status === "complete";
              if (allCardsConclusivelyEmpty) {
                message = "No trackable benefits are available in the reviewed card observations.";
              } else if (totalBenefits === 0) {
                message = "No benefit rows are available in the local observations.";
              } else {
                const otherFilter = this.benefitFilter === "remaining" ? "used" : "remaining";
                const otherCount = filterCounts[otherFilter];
                message = `No ${filterLabel(this.benefitFilter).toLowerCase()} benefit rows are available. ${otherCount} ${filterLabel(otherFilter).toLowerCase()} benefit${otherCount === 1 ? " is" : "s are"} available under ${filterLabel(otherFilter)}.`;
              }
              const empty = element("p", message);
              empty.className = "empty-state account-empty-state";
              content.append(empty);
            }
          } else {
            const empty = element("p", "No local card observations yet. Start a scan when you are ready.");
            empty.className = "empty-state";
            content.append(empty);
          }
          panel.append(content);
          const footer = element("div");
          footer.className = "footer";
          const privacy = element("details");
          privacy.className = "secondary-panel privacy-details";
          privacy.append(element("summary", "Data and privacy"));
          privacy.append(element("p", "Only normalized observations and a local identity fingerprint are stored in Tampermonkey. Clearing data also removes the local identity secret."));
          const clear = element("button", "Clear local data");
          clear.type = "button";
          clear.className = "clear-button";
          clear.disabled = this.mode === "syncing";
          clear.addEventListener("click", () => void this.clear());
          privacy.append(clear);
          footer.append(privacy);
          panel.append(footer);
          this.root.append(style, panel);
        }
      };
    }
  });

  // src/userscripts/amex-benefit-reader/visible-context.ts
  function isSupportedAmexOrigin(locationValue = window.location) {
    return locationValue.origin === AMEX_MEMBER_ORIGIN;
  }
  function isPrimaryAmexBenefitsRoute(locationValue = window.location) {
    return isSupportedAmexOrigin(locationValue) && AMEX_BENEFITS_PATHS.has(locationValue.pathname);
  }
  function displayFingerprint(root) {
    const element2 = root.querySelector(SELECTED_CARD_DISPLAY);
    if (!element2) return null;
    const display = (element2.getAttribute("aria-label") ?? element2.textContent ?? "").trim().replace(/\s+/g, " ");
    if (!display) return null;
    let first = 2166136261;
    let second = 2654435769;
    for (let index = 0; index < display.length; index += 1) {
      const code = display.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619) >>> 0;
      second = Math.imul(second ^ code + index, 2246822507) >>> 0;
    }
    return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
  }
  var AMEX_MEMBER_ORIGIN, AMEX_BENEFITS_PATHS, SELECTED_CARD_DISPLAY, AmexVisibleContextGuard;
  var init_visible_context = __esm({
    "src/userscripts/amex-benefit-reader/visible-context.ts"() {
      "use strict";
      AMEX_MEMBER_ORIGIN = "https://global.americanexpress.com";
      AMEX_BENEFITS_PATHS = /* @__PURE__ */ new Set(["/card-benefits/view-all", "/card-benefits/activity"]);
      SELECTED_CARD_DISPLAY = '[data-testid="simple_switcher_combobox"][role="combobox"], [data-testid*="account-selector"] button[aria-expanded], [data-pr-account-selector-trigger]';
      AmexVisibleContextGuard = class {
        constructor(locationValue = window.location, root = document) {
          this.locationValue = locationValue;
          this.root = root;
        }
        capture() {
          if (!isSupportedAmexOrigin(this.locationValue)) throw new Error("Unsupported Amex origin.");
          return {
            route: this.locationValue.pathname,
            selectedCardDisplayFingerprint: displayFingerprint(this.root)
          };
        }
        verifyUnchanged(context) {
          if (!isSupportedAmexOrigin(this.locationValue) || this.locationValue.pathname !== context.route) return false;
          return context.selectedCardDisplayFingerprint === null || displayFingerprint(this.root) === context.selectedCardDisplayFingerprint;
        }
      };
    }
  });

  // src/userscripts/amex-benefit-reader/reader-runtime.ts
  var reader_runtime_exports = {};
  __export(reader_runtime_exports, {
    mountAmexBenefitReader: () => mountAmexBenefitReader
  });
  function markMountedReaderVersion(version) {
    document.getElementById(AMEX_READER_HOST_ID)?.setAttribute("data-reader-version", version);
  }
  async function mountAmexBenefitReader(version, handoffTargetName = "production", options = {}) {
    if (!isSupportedAmexOrigin() || document.getElementById(AMEX_READER_HOST_ID)) return;
    const initiallyCollapsed = options.initiallyCollapsed ?? !isPrimaryAmexBenefitsRoute();
    const store = options.adapters?.store ?? new TampermonkeyResultStore();
    const adapters = options.adapters ?? {
      store,
      mailboxStorage: new TampermonkeyMailboxStorage(),
      identity: new TampermonkeyCardIdentityService()
    };
    try {
      const initialStore = await store.load();
      if (document.getElementById(AMEX_READER_HOST_ID)) return;
      let engine = null;
      let panel = null;
      const reporter = { report: (progress) => panel?.report(progress) };
      panel = new AmexBenefitReaderPanel(initialStore, {
        startScan: async () => {
          if (!engine) throw new Error("The local scanner is not ready.");
          await engine.scanAllCards();
        },
        cancelScan: () => engine?.cancel(),
        syncReviewed: async () => {
          const popup = window.open("about:blank", "_blank");
          if (!popup) throw new Error("Allow pop-ups for Amex, then choose Sync reviewed again.");
          popup.opener = null;
          try {
            const projection = projectLatestV3SyncEnvelope(await store.load());
            if (!projection.envelope) {
              throw new Error(projection.reason === "fresh_v3_scan_required" ? "Run and review a fresh complete scan before syncing." : "No complete reviewed card observations are available to sync.");
            }
            const mailbox = await createAmexSyncMailbox(projection.envelope);
            await storeAmexSyncMailbox(adapters.mailboxStorage, mailbox);
            popup.location.replace(amexSyncHandoffUrl(mailbox.transferId, handoffTargetName));
          } catch (error) {
            popup.close();
            throw error;
          }
        },
        clearData: () => store.clear()
      }, { initiallyCollapsed });
      markMountedReaderVersion(version);
      engine = new AmexBenefitScanEngine(
        new AmexApiClient(),
        new AmexVisibleContextGuard(),
        store,
        adapters.identity,
        reporter
      );
      window.addEventListener("beforeunload", () => engine?.cancel(), { once: true });
    } catch {
      if (document.getElementById(AMEX_READER_HOST_ID)) return;
      AmexBenefitReaderPanel.mountError(
        "Local reader data is malformed or from an unsupported version. Clear local data to recover.",
        () => store.clear(),
        { initiallyCollapsed }
      );
      markMountedReaderVersion(version);
    }
  }
  var init_reader_runtime = __esm({
    "src/userscripts/amex-benefit-reader/reader-runtime.ts"() {
      "use strict";
      init_amex_api_client();
      init_scan_engine();
      init_sync_mailbox();
      init_sync_contract();
      init_panel();
      init_tampermonkey_storage();
      init_visible_context();
    }
  });

  // src/userscripts/amex-benefit-reader.user.ts
  init_handoff_target();

  // src/userscripts/amex-benefit-reader/handoff-runtime.ts
  init_sync_mailbox();
  function mountAmexSyncHandoffBridge(target, storage2, pageWindow = window) {
    let activeMailbox = null;
    let clearTimer = null;
    let loading = false;
    const finish = () => {
      if (clearTimer !== null) window.clearTimeout(clearTimer);
      pageWindow.removeEventListener("message", receiveMessage);
    };
    const expire = () => {
      void clearAmexSyncMailbox(storage2).finally(finish);
    };
    const receiveMessage = (event) => {
      if (event.source !== pageWindow || event.origin !== target.origin) return;
      const accepted = handoffAcceptedMessageSchema.safeParse(event.data);
      if (accepted.success && activeMailbox && accepted.data.transferId === activeMailbox.transferId && accepted.data.nonce === activeMailbox.nonce) {
        activeMailbox = null;
        void clearAmexSyncMailbox(storage2).finally(finish);
        return;
      }
      const ready = handoffReadyMessageSchema.safeParse(event.data);
      if (!ready.success || loading || activeMailbox) return;
      loading = true;
      void loadAmexSyncMailbox(storage2, ready.data.transferId).then((mailbox) => {
        activeMailbox = mailbox;
        pageWindow.postMessage({
          type: "perks-reminder:amex-sync-payload",
          transferId: mailbox.transferId,
          nonce: mailbox.nonce,
          digest: mailbox.digest,
          envelope: mailbox.envelope
        }, target.origin);
        clearTimer = window.setTimeout(expire, 2e4);
      }).catch(finish).finally(() => {
        loading = false;
      });
    };
    pageWindow.addEventListener("message", receiveMessage);
  }

  // src/userscripts/amex-benefit-reader.user.ts
  init_tampermonkey_storage();
  var AMEX_READER_ORIGIN = "https://global.americanexpress.com";
  var AMEX_SYNC_HANDOFF_TARGET = resolveAmexSyncHandoffTarget("production");
  function isExactHandoffPage() {
    if (window.location.origin !== AMEX_SYNC_HANDOFF_TARGET.origin || window.location.pathname !== AMEX_SYNC_HANDOFF_TARGET.path) return false;
    const params = new URLSearchParams(window.location.search);
    return Array.from(params.keys()).length === 1 && /^[a-f0-9]{32}$/.test(params.get("transfer") ?? "");
  }
  function mountHandoffBridge() {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    mountAmexSyncHandoffBridge(AMEX_SYNC_HANDOFF_TARGET, new TampermonkeyMailboxStorage(), pageWindow);
  }
  async function main() {
    if (window.top !== window.self) return;
    if (isExactHandoffPage()) {
      mountHandoffBridge();
      return;
    }
    if (window.location.origin !== AMEX_READER_ORIGIN) return;
    const { mountAmexBenefitReader: mountAmexBenefitReader2 } = await Promise.resolve().then(() => (init_reader_runtime(), reader_runtime_exports));
    await mountAmexBenefitReader2("1.0.0", AMEX_SYNC_HANDOFF_TARGET.name);
  }
  void main();
})();
