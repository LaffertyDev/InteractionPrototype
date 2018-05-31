import { IInteractionContext } from './../interaction/interactioncontext.js';
import { InteractionManager } from './../interaction/interactionmanager.js';
import ContextMenuElement from "./contextmenu.js";
import VTouch from "../touchable/vtouch.js";

const ContextMenuId = 'contextmenu';

/**
 * Class is responsible for global context manager support
 */
export default class ContextManager {

	constructor(private interactionManager: InteractionManager) {
		// this would be moved to the IInterfaceContext
		document.documentElement.oncontextmenu = (ev: MouseEvent) => { this.ContextEvent(ev); };
		// this would be moved to the IInterfaceContext
		document.documentElement.onmouseup = (ev: MouseEvent) => {
			if(this.ShouldClearMenu(ev.target)) {
				this.ClearMenu();
			}
		};
	}

	ShouldClearMenu(target: EventTarget | null): boolean {
		return target == null || (<HTMLElement>target).id !== ContextMenuId;
	}

	ClearMenu(): void {
		let contextMenu = <ContextMenuElement | null>document.getElementById(ContextMenuId);
		if(contextMenu !== null) {
			(<HTMLElement>contextMenu.parentElement).removeChild(contextMenu);
		}
	}

	HandleLongPress(event: VTouch): void {
		if(this.ShouldSpawnContextMenu(event.target)) {
			this.SpawnContextMenu(event.pageX, event.pageY);
		}
	}

	ContextEvent(event: MouseEvent): void {
		if(event.ctrlKey) {
			// let normal context menu proceed
			return;
		}

		if(this.ShouldSpawnContextMenu(event.target)) {
			event.preventDefault();
			this.SpawnContextMenu(event.pageX, event.pageY);
		}
	}

	/**
	 * Given a target element, determines if the context menu should spawn
	 */
	private ShouldSpawnContextMenu(target: EventTarget | null): boolean {
		// Create context menu if the right click is not already on a context menu
		if(target === null) {
			return false;
		}

		if ((<HTMLElement>target).id === ContextMenuId) {
			return false;
		}

		// this would break if user right clicks on context menu and there is no selection
		let activeContext = this.interactionManager.FindActiveContext();
		if(activeContext === null) {
			return false;
		}

		let activeSelection = activeContext.GetActiveSelection();
		return activeSelection !== null;
	}

	private SpawnContextMenu(positionX: number, positionY: number): void {
		let mainElement = <HTMLElement>document.getElementsByTagName("main")[0];
		let contextMenu = <ContextMenuElement>document.createElement("context-menu");
		contextMenu.id = ContextMenuId;
		contextMenu.style.background = "white";
		contextMenu.style.position = "absolute";
		contextMenu.style.border = "1px solid black";
		contextMenu.style.boxShadow = "4px 4px 4px 0px #bb7474";
		contextMenu.style.top = positionY.toString();
		contextMenu.style.left = positionX.toString();

		// Note: This breaks if I want to just right click on Canvas and get default options
		let activeContext = this.interactionManager.FindActiveContext();
		if(activeContext === null) {
			throw new Error();
		}
		let activeSelection = activeContext.GetActiveSelection();
		if(activeSelection === null) {
			throw new Error();
		}
		contextMenu.actions = activeSelection.GetContextActions();
		mainElement.appendChild(contextMenu);
	}
}