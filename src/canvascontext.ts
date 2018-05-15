import { IInterfaceContext } from "./interfacecontext.js";
import { DataTransferTypes } from "./clipboard.js";

export class CanvasContext implements IInterfaceContext {
	private pasteHistory: string[] = [];
	constructor(public Id: string) {

	}

    /**
     * The element's custom handled 'Cut' operation
     *
     * This method should REMOVE the element via a command (so the user can undo it) and return a DataTransfer object representing the data entirely so it can be replicated
     */
	HandleCut(): DataTransfer {
		let data = new DataTransfer();
		data.setData(DataTransferTypes.Text, 'WOH SOME TEXT HERE');
		return data;
	}

    /**
     * The element's custom handled 'Copy' operation
     *
     * This method should make a copy of the data in a DataTransfer object so it can be replicated at-will from the user
     */
	HandleCopy(): DataTransfer {
		let data = new DataTransfer();
		data.setData(DataTransferTypes.Text, 'WOH SOME TEXT HERE');
		return data;
	}

    /**
     * The element's custom handled 'Paste' operation
     *
     * This method should build a "Paste Event" into the command stack so the user can undo this.
     * @param data to be pasted
     */
	HandlePaste(data: DataTransfer): void {
		this.pasteHistory.push(data.getData(DataTransferTypes.Text));
		// quick and dirty paste demonstration
		let canvas = <HTMLCanvasElement>document.getElementById(this.Id);
		let canvasCtx = <CanvasRenderingContext2D>canvas.getContext("2d");
		canvasCtx.clearRect(0, 0, 400, 600);
		let idx = 0;
		for (let paste of this.pasteHistory) {
			canvasCtx.fillText(paste, 50, idx * 50, 40);
			idx++;
		}
	}
}