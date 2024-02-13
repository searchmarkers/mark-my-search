import { EleClass } from "/dist/modules/common.mjs";
import type { ControlButtonName } from "/dist/modules/interface/toolbar.mjs";

const controlGetClass = (controlName: ControlButtonName) =>
	EleClass.CONTROL + "-" + controlName
;

const getControlPadClass = (index: number) => EleClass.CONTROL_PAD + "-" + index.toString();

export { controlGetClass, getControlPadClass };
