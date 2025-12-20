---
title: ABC Notation Demo
slug: abc-notation
date: 2025-12-20
tags: [music]
category: Test
fontTheme: theme-academic
draft: false
---

# ABC Notation Demo

Here is a simple scale:

```abc
X: 1
T: C Major Scale
M: 4/4
L: 1/4
K: C
C D E F | G A B c | c B A G | F E D C |]
```

Here is a more complex tune (excerpt):

```abc
X: 2
T: Cooley's
M: 4/4
L: 1/8
R: reel
K: Emin
|:D2|EB{c}BA B2 EB|~B2 AB dBAG|FDAD BDAD|FDAD dAFD|
EBBA B2 EB|B2 AB defg|afe^c dBAF|DEFD E2:|
```

Here is a grand staff example with High, Middle, and Low ACE chords:

```abc
X:1
T: The 3 ACE Groups
M:4/4
L:1/1
K:C
%%staves {RH LH}
%%staffsep 40  
V:RH clef=treble name="右手"
[A c e] | [C E] | z |]
V:LH clef=bass name="左手"
z | A, | [A,, C, E,] |]
```

