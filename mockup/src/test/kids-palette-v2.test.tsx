// Owner's call (24/10): in the EXPANDED kids sheet the spectrum and its hue
// slider are redundant — the family row plus the family's own ramp already
// reach every colour.
//
// The COMPACT colour area moved out of this component (26/10, `cor-compacta`):
// both bands mount `CompactColor`, so the bar cannot drift into a kids copy of
// the same rows. Its behaviour is covered by `compacta-cor.test.tsx`.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KidsPalette } from "@/mockup/screens/PaletteTray";

const props = {
  color: "#FB2C36",
  familyIdx: 0,
  onFamily: () => {},
  onPick: () => {},
};

afterEach(() => cleanup());

describe("kids palette: choose, then vary", () => {
  it("expanded: no spectrum and no hue slider", () => {
    render(<KidsPalette {...props} />);
    expect(screen.queryByTestId("hsl-picker")).toBeNull();
    expect(screen.queryByTestId("hue-bar")).toBeNull();
    expect(screen.queryByTestId("compact-spectrum")).toBeNull();
    expect(screen.getByTestId("kids-palette")).toBeInTheDocument();
  });

  it("expanded: still reaches the whole catalog in two steps", () => {
    render(<KidsPalette {...props} />);
    expect(screen.getByTestId("simple-palette")).toBeInTheDocument();
    expect(screen.getByTestId("kids-tone-row")).toBeInTheDocument();
    expect(screen.getByTestId("kids-neutral-row")).toBeInTheDocument();
  });

  it("expanded: the families walk with two doors, never a scroll", () => {
    render(<KidsPalette {...props} />);
    // Page 0 of three: one door forward, none back (a door that is not there
    // for this page is not rendered as a ghost either).
    expect(screen.getByTestId("kids-family-next")).toBeInTheDocument();
    expect(screen.queryByTestId("kids-family-prev")).toBeNull();
  });
});
