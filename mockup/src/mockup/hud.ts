// The canvas bottom is two bands, and the dock owns the lower one.
//
// The HUD row ("guardar" on the right, the zoom stepper on the left) rides on
// top of whatever the dock is showing — the resting pill, the compact bar or
// the expanded sheet — inside ONE flex column. Because the row and the dock are
// siblings with a fixed gap, a dock that grows pushes the row up; it cannot grow
// underneath it and the two can never share a pixel at any frame width.
//
// It used to be an absolute `bottom` computed from the pill's 48dp height token,
// which is a guess: the 3-5 pill is 60dp, so the zoom row overlapped its top by
// 4dp, and "guardar" (anchored right) met the centred pill on a 360dp frame. The
// gap is a contract, so it lives here as the one number both the column and the
// browser measurement talk about.
//
// jsdom has no layout, so the unit test can only hold the shape (one column, the
// row first, the dock second, this token); the pixel proof is the CDP pass in
// the investigation harness, never a hand-computed number.
export const HUD_DOCK_GAP = 12;
