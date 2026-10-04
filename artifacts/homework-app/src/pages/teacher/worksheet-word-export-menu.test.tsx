import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorksheetWordExportMenu } from "./worksheet-word-export-menu";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens choices only after pointer-up and never exports just by opening the menu", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const onExport = vi.fn();
  render(<WorksheetWordExportMenu ar onExport={onExport} testId="word-trigger" />);
  const trigger = screen.getByTestId("word-trigger");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  expect(screen.queryByTestId("word-export-visual")).toBeNull();
  fireEvent.pointerUp(trigger, { button: 0 });
  fireEvent.click(trigger);
  expect(screen.getByTestId("word-export-visual")).not.toBeNull();
  expect(onExport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId("word-export-editable"));
  expect(onExport).toHaveBeenCalledExactlyOnceWith("editable");
  expect(screen.queryByTestId("word-export-visual")).toBeNull();
});

it("keeps both choices unavailable during an export", () => {
  const onExport = vi.fn();
  render(<WorksheetWordExportMenu ar onExport={onExport} disabled busy testId="word-trigger" />);
  const trigger = screen.getByTestId("word-trigger") as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  fireEvent.click(trigger);
  expect(onExport).not.toHaveBeenCalled();
  expect(screen.queryByTestId("word-export-editable")).toBeNull();
});