import { ClipboardDict } from './clipboarddict.js';
import { InterfaceManager } from './../interfacemanager.js';
import { DataTransferTypes } from '../datatransfertypes.js';

export default class ClipboardManager {
	private internalClipboardData: DataTransfer | null;

	constructor(private uiManager: InterfaceManager) {
		this.internalClipboardData = null;

		// Why does the binding to "This" work within these methods?
		document.documentElement.oncut = (event: ClipboardEvent) => { this.OnExternalCut(event) };
		document.documentElement.onpaste = (event: ClipboardEvent) => { this.OnExternalPaste(event) };
		document.documentElement.oncopy = (event: ClipboardEvent) => { this.OnExternalCopy(event) };
	}

	/**
	 * NOTE: This is unsupported in ALL browsers
	 * https://www.w3.org/TR/clipboard-apis/#clipboard-events-and-interfaces
	 * 
	 * This should fire if a user copies something EXTERNALLY
	 */
	OnClipboardChange = (event: ClipboardEvent): void => {
		// When this is supported, it will solve the "System" -> "Internal" use case
		this.internalClipboardData = event.clipboardData;
	}

	/**
	 * Also solves the "External" -> "Internal" paste problem, but requires browser permissions so not ideal
	 */
	async AttemptReadClipboardData(): Promise<DataTransfer | null> {
		let clipboard: any = (<any>navigator).clipboard;
		return clipboard.read();
	}

	/**
	 * When a browser clipboard copy event is intercepted, check which element has the current focus
	 * If it is the INTERNAL clipboard element, then procede with our app-specific copy rules
	 * Otherwise, let the action persist natively.
	 * 
	 * Fired:  right-click -> `copy`, ctrl-c, etc. in the browser context
	 * 
	 * Behavior:
	 * 1. User fires action request
	 * 2. App checks if any canvas / internal elements have focus. If they don't, exit and let the action persist as normal
	 * 3. The canvas element has focus, check the current "selected" element. If there is no "selected" element and no judgement can be made, exit and let the action persist as normal
	 * 4. Copy the data to both the internal AND external clipboard
	 * 
	 * We copy to both the internal and external buffers so all copy/paste instances are unified.
	 */
	OnExternalCopy(event: ClipboardEvent): void {
		if(event.type !== ClipboardDict.Copy) {
			throw new Error(`Cannot perform ${event.type} action on copy`);
		}

		if(!event.isTrusted) {
			throw new Error('All external clipboard events must be trusted.');
		}

		let activeContext = this.uiManager.FindActiveContext();
		if(activeContext === null) {
			// To support External -> Internal paste, I will have to manually convert the copy types
			// Is there a way to do this natively?
			
			// Alternatively, if "OnClipboardChange" fires, that will solve this use case
			this.internalClipboardData = null;
			return;
		}

		event.preventDefault();
		let ctxCopiedData = activeContext.HandleCopy();
		if(ctxCopiedData.items.length <= 0) {
			return;
		}
		this.internalClipboardData = ctxCopiedData;
		this.AttemptCopyClipboardData(this.internalClipboardData, event);
	}

	/**
	 * Internal Copy is fired when we do not have a browser-specific copy context. 
	 * 
	 * Fired: `right-click -> copy` in a canvas or any other non-native elements that custom clipboard code must be bound to
	 * 
	 * Behavior:
	 * 1. User fires action request
	 * 2. Grab the "Selected" item from the current context
	 * 3. Copy the data into the internal buffer, and ATTEMPT to copy the data into the external buffer
	 * 
	 * After we copy into our INTERNAL clipboard, we want to attempt to persist the copy in the SYSTEM clipboard. This requires external permissions, however.
	 * 
	 * Without these permissions, the UNDESIRABLE workflow could be:
	 * 
	 * 1. User copies text outside of app
	 * 2. User copies text within app (without using browser-level copy like ctrl-c)
	 * 3. User pastes text ouside of app, which is the same text as #1
	 * 
	 * With the permissions, the workflow would be:
	 * 
	 * 1. User copies text outside of app
	 * 2. User copies text within app (without using browser-level copy like ctrl-c)
	 * 3. User pastes text outside of app, which is the same text as #2
	 */
	OnInternalCopy(): void {
		let activeContext = this.uiManager.FindActiveContext();
		if(activeContext === null) {
			this.internalClipboardData = null;
			return;
		}

		let ctxCopiedData = activeContext.HandleCopy();
		if(ctxCopiedData.items.length <= 0) {
			return;
		}
		this.internalClipboardData = ctxCopiedData;
		this.AttemptCopyClipboardData(this.internalClipboardData);
	}

	/**
	 * External browser-controlled cut action.
	 * 
	 * Fired: ctrl-x, right click -> cut
	 * 
	 * Behavior:
	 * 
	 * 1. User fires action request
	 * 2. App checks if any canvas / internal elements have focus. If they don't, exit and let the action persist as normal
	 * 3. The canvas element has focus, check the current "selected" element. If there is no "selected" element and no judgement can be made, exit and let the action persist as normal
	 * 4a. Fire a "Cut" action and push onto the command stack
	 * 4b. Remove the "Selected" element and copy the data to both the internal AND external clipboard
	 * 
	 * We copy to both the internal and external clipboards so all copy/paste instances are unified.
	 */
	OnExternalCut(event: ClipboardEvent): void {
		if(event.type !== ClipboardDict.Cut) {
			throw new Error(`Cannot perform ${event.type} action on cut`);
		}

		if(!event.isTrusted) {
			throw new Error('All external clipboard events must be trusted.');
		}

		let activeContext = this.uiManager.FindActiveContext();
		if(activeContext === null) {
			this.internalClipboardData = null;
			return;
		}
		
		event.preventDefault();
		let ctxCutData = activeContext.HandleCut();
		if(ctxCutData.items.length <= 0) {
			return;
		}
		this.internalClipboardData = ctxCutData;
		this.AttemptCopyClipboardData(this.internalClipboardData, event);
	}

	/**
	 * Internal app-controlled cut action.
	 * 
	 * Fired: right click -> cut within app context
	 * 
	 * Behavior:
	 * 
	 * 1. User fires action request
	 * 2. Grab the "selected" element context from the action
	 * 3a. Fire a "Cut" action and push onto the command stack
	 * 3b. Remove the "Selected" element, copy the element into the internal clipboard, and ATTEMPT to copy the element into the external clipboard
	 */
	OnInternalCut(): void {
		let activeContext = this.uiManager.FindActiveContext();
		if(activeContext === null) {
			this.internalClipboardData = null;
			return;
		}

		let ctxCutData = activeContext.HandleCut();
		if(ctxCutData.items.length <= 0) {
			return;
		}
		this.internalClipboardData = ctxCutData;
		this.AttemptCopyClipboardData(this.internalClipboardData);
	}

	/**
	 * External browser-controlled paste action
	 * 
	 * Fired: ctrl-v, right click -> paste within browser context
	 * 
	 * Behavior:
	 * 
	 * 1. User fires action request
	 * 2. App checks if any canvas / internal elements have focus. If they don't, exit and let the action persist as normal
	 * 3. The canvas element has focus, check the current "selected" element. If there is no "selected" element and no judgement can be made, exit and let the action persist as normal
	 * 4. Fire a "Paste" action into the command stack with the most-recent "copied" item
	 * 
	 * There is a nuance between the two buffers and "paste". If we DON'T have permission to asynchronously control the buffer, there can be two different sets of data in the "paste" context. Example:
	 * 
	 * 1. User uses browser context to "Copy" a string of data at T:00
	 * 2. User uses app context to "Copy" a string of data at T:10
	 * 3. User fires an external "Paste" request that can be bound to a context
	 * 
	 * The data that SHOULD be bound would be data #2.
	 */
	OnExternalPaste(event: ClipboardEvent): void {
		if(event.type !== ClipboardDict.Paste) {
			throw new Error(`Cannot perform ${event.type} action on paste`);
		}

		if(!event.isTrusted) {
			throw new Error('All external clipboard events must be trusted.');
		}

		let activeContext = this.uiManager.FindActiveContext();
		if(activeContext === null) {
			return;
		}

		let dataToUse: DataTransfer;
		if(this.internalClipboardData === null) {
			dataToUse = event.clipboardData;
		} else {
			dataToUse = <DataTransfer>this.internalClipboardData;
		}
		event.preventDefault();
		activeContext.HandlePaste(dataToUse);
	}

	/**
	 * Internal element triggered paste event.
	 * 
	 * Fired: right-click, paste or internal paste buttons
	 * 
	 * Behavior:
	 * 1. User fires action request
	 * 2. Find the component that the paste should be triggered into
	 * 3. Fire a "Paste" action into the command stack with the most-recent "copied" item
	 */
	OnInternalPaste(): void {
		if(this.internalClipboardData == null) {
			return;
		}

		let activeContext = this.uiManager.FindActiveContext();
		if(activeContext === null) {
			return;
		}

		activeContext.HandlePaste(this.internalClipboardData);
	}

	async AttemptCopyClipboardData(data: DataTransfer, event?: ClipboardEvent): Promise<void> {
		/**
		 * Note: Chrome does not currently support arbitrary "Write" operations
		 * 
		 * This means this will only support text copy for now. "Write" will probably (hopefully) be implemented within the next year.
		 * 
		 * https://developer.mozilla.org/en-US/docs/Web/Events/paste
		 */
		let clipboard: any = (<any>navigator).clipboard;
		await clipboard.writeText(data.getData(DataTransferTypes.Text));
		// await clipboard.write(data);
	}
}