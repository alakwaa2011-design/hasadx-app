import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  getTutorialYoutubeVideoId,
  TutorialVideoButton,
  TutorialVideoModal,
} from "./tutorial-video";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("tutorial video", () => {
  it("accepts only YouTube links or a valid video ID", () => {
    expect(getTutorialYoutubeVideoId({ youtubeUrl: "https://www.youtube.com/watch?v=oMaDMEM40l4&t=14" })).toBe("oMaDMEM40l4");
    expect(getTutorialYoutubeVideoId({ youtubeUrl: "https://youtu.be/oMaDMEM40l4" })).toBe("oMaDMEM40l4");
    expect(getTutorialYoutubeVideoId({ youtubeVideoId: "oMaDMEM40l4" })).toBe("oMaDMEM40l4");
    expect(getTutorialYoutubeVideoId({ youtubeUrl: "https://youtube.com.evil.example/watch?v=oMaDMEM40l4" })).toBeNull();
    expect(getTutorialYoutubeVideoId({ youtubeUrl: "javascript:alert(1)" })).toBeNull();
  });

  it("opens on click without autoplay and unmounts the video when closed", () => {
    render(
      <TutorialVideoButton
        title="إنشاء واجب في حصاد"
        description="شرح خطوة بخطوة"
        youtubeUrl="https://www.youtube.com/watch?v=oMaDMEM40l4"
      />,
    );
    expect(screen.queryByTestId("iframe-tutorial-video")).toBeNull();
    fireEvent.click(screen.getByTestId("button-tutorial-video"));
    const iframe = screen.getByTestId("iframe-tutorial-video") as HTMLIFrameElement;
    expect(iframe.src).toBe("https://www.youtube-nocookie.com/embed/oMaDMEM40l4");
    expect(iframe.src).not.toContain("autoplay");
    expect(screen.getByTestId("title-tutorial-video").textContent).toBe("إنشاء واجب في حصاد");
    expect(screen.getByTestId("link-tutorial-youtube").getAttribute("href")).toBe("https://www.youtube.com/watch?v=oMaDMEM40l4");
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(screen.queryByTestId("iframe-tutorial-video")).toBeNull();
  });

  it("shows an explicit error for a bad video address", () => {
    render(
      <TutorialVideoModal
        title="Video"
        youtubeUrl="https://not-youtube.example/video"
        open
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("غير صالح");
    expect(screen.queryByTestId("iframe-tutorial-video")).toBeNull();
    expect(screen.queryByTestId("link-tutorial-youtube")).toBeNull();
  });
});