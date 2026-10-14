// Golden programs (the Unit 5 lesson programs and their fixes), in canonical layout.

export const BLINK = `void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

/** Lesson 14's heartbeat: setup on lines 1 to 3, loop on lines 4 to 13, the first delay(100) on line 6. */
export const HEARTBEAT = `void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(100);
  digitalWrite(13, LOW);
  delay(100);
  digitalWrite(13, HIGH);
  delay(100);
  digitalWrite(13, LOW);
  delay(700);
}
`;

export const BUTTON = `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}
void loop() {
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}
`;

export const COUNT_PRESSES = `int count = 0;
int last = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}
void loop() {
  int now = digitalRead(2);
  if (now != last) {
    if (now == LOW) {
      count++;
      Serial.println(count);
    }
    last = now;
  }
}
`;

/** The fix: wait out the bounce after every change. */
export const DEBOUNCED = COUNT_PRESSES.replace("    last = now;\n", "    last = now;\n    delay(50);\n");

export const BLOCKING_BLINK_AND_LISTEN = `void setup() {
  pinMode(13, OUTPUT);
  pinMode(7, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
  if (digitalRead(2) == LOW) {
    digitalWrite(7, HIGH);
  } else {
    digitalWrite(7, LOW);
  }
}
`;

export const NON_BLOCKING = `unsigned long last = 0;
bool lampOn = false;

void setup() {
  pinMode(13, OUTPUT);
  pinMode(7, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}
void loop() {
  if (millis() - last >= 1000) {
    last = millis();
    lampOn = !lampOn;
    digitalWrite(13, lampOn);
  }
  if (digitalRead(2) == LOW) {
    digitalWrite(7, HIGH);
  } else {
    digitalWrite(7, LOW);
  }
}
`;

/** Lesson 17's fix-it: adding to millis() overflows near the wrap. */
export const LIGHTHOUSE_UNSAFE = `unsigned long next = 0;
bool on = false;

void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  if (millis() >= next) {
    next = millis() + 5000;
    on = !on;
    digitalWrite(13, on);
  }
}
`;

export const LIGHTHOUSE_SAFE = `unsigned long last = 0;
bool on = false;

void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  if (millis() - last >= 5000) {
    last = millis();
    on = !on;
    digitalWrite(13, on);
  }
}
`;

/** Lesson 18's die: rolls every 60 ms, a debounced press stops or restarts the roll, the pips show the face. */
export const DICE = `unsigned long lastRoll = 0;
int face = 1;
bool rolling = true;
int last = HIGH;

void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(4, OUTPUT);
  pinMode(5, OUTPUT);
  pinMode(6, OUTPUT);
  pinMode(7, OUTPUT);
  Serial.begin(9600);
}

void showFace() {
  digitalWrite(4, LOW);
  digitalWrite(5, LOW);
  digitalWrite(6, LOW);
  digitalWrite(7, LOW);
  if (face % 2 == 1) digitalWrite(4, HIGH);
  if (face > 1) digitalWrite(5, HIGH);
  if (face > 3) digitalWrite(6, HIGH);
  if (face == 6) digitalWrite(7, HIGH);
}

void loop() {
  if (rolling && millis() - lastRoll >= 60) {
    lastRoll = millis();
    face = random(1, 7);
    Serial.println(face);
    showFace();
  }
  int now = digitalRead(2);
  if (now != last) {
    if (now == LOW) {
      rolling = !rolling;
    }
    last = now;
    delay(50);
  }
}
`;

/** The pins each face lights: centre (4), pair A (5), pair B (6), middle pair (7). */
export const PIPS: Record<number, [number, number, number, number]> = {
  1: [1, 0, 0, 0],
  2: [0, 1, 0, 0],
  3: [1, 1, 0, 0],
  4: [0, 1, 1, 0],
  5: [1, 1, 1, 0],
  6: [0, 1, 1, 1],
};

export const FADE = `void setup() {
  pinMode(9, OUTPUT);
}
void loop() {
  analogWrite(9, 64);
}
`;
