"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { PASSAGES } from "./passages";
import logo from "../public/TypeFast Speedmark Logo.png";

function shuffledPassages() {
  const passages = [...PASSAGES];
  for (let index = passages.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [passages[index], passages[swapIndex]] = [passages[swapIndex], passages[index]];
  }
  return passages.map((passage) => passage.replace(/\s+/g, " ").trim()).join(" ");
}

const INITIAL_TEXT = PASSAGES.map((passage) => passage.replace(/\s+/g, " ").trim()).join(" ");

export default function Home() {
  const [duration, setDuration] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);
  const [text, setText] = useState(INITIAL_TEXT);
  const [typedText, setTypedText] = useState("");
  const [combo, setCombo] = useState(0);
  const [recordCombo, setRecordCombo] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [characterTimes, setCharacterTimes] = useState<number[]>([]);
  const [inputScroll, setInputScroll] = useState({ left: 0, top: 0 });
  const passageRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPassageFollowingRef = useRef(false);
  const characterTimesRef = useRef<number[]>([]);
  const lastKeystrokeAtRef = useRef<number | null>(null);

  const words = useMemo(() => text.trim().split(/\s+/), [text]);
  const characters = useMemo(() => Array.from(text), [text]);
  const typedCharacters = useMemo(() => Array.from(typedText), [typedText]);
  let wordStart = 0;
  const correctWords: string[] = [];
  const incorrectWords = new Map<string, number>();
  const confusedCharacters = new Map<string, number>();
  const incorrectCharacterIndexes = new Set<number>();
  let errorCount = 0;

  for (const word of words) {
    const wordCharacters = Array.from(word);
    const entered = typedCharacters.slice(wordStart, wordStart + wordCharacters.length);
    const hasCharacterError = entered.some((character, index) => character !== wordCharacters[index]);
    const isCompleteAndCorrect = entered.length === wordCharacters.length && !hasCharacterError;
    if (isCompleteAndCorrect) {
      correctWords.push(word);
    }
    const separatorIndex = wordStart + wordCharacters.length;
    const hasSeparatorError = separatorIndex < typedCharacters.length && typedCharacters[separatorIndex] !== " ";
    if (hasCharacterError || hasSeparatorError) {
      errorCount += 1;
      incorrectWords.set(word, (incorrectWords.get(word) ?? 0) + 1);
      for (let index = wordStart; index < Math.min(wordStart + wordCharacters.length, typedCharacters.length); index += 1) {
        incorrectCharacterIndexes.add(index);
      }
      if (hasSeparatorError) incorrectCharacterIndexes.add(separatorIndex);
    }

    for (let index = 0; index < entered.length; index += 1) {
      const expectedCharacter = wordCharacters[index];
      if (entered[index] !== expectedCharacter && expectedCharacter !== " ") {
        confusedCharacters.set(expectedCharacter, (confusedCharacters.get(expectedCharacter) ?? 0) + 1);
      }
    }
    wordStart += wordCharacters.length + 1;
  }

  const correctWordCount = correctWords.length;
  const correctCharacterCount = typedCharacters.reduce(
    (count, character, index) => count + (character === characters[index] ? 1 : 0),
    0,
  );
  const mostConfusedCharacters = [...confusedCharacters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mostMissedWords = [...incorrectWords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const slowestCharacter = characterTimes.reduce<{ character: string; seconds: number } | null>(
    (slowest, seconds, index) => seconds > 0 && (!slowest || seconds > slowest.seconds)
      ? { character: characters[index], seconds }
      : slowest,
    null,
  );
  const progress = Math.min((typedText.length / text.length) * 100, 100);

  useEffect(() => {
    const shuffleOnLoad = window.setTimeout(() => setText(shuffledPassages()), 0);
    return () => window.clearTimeout(shuffleOnLoad);
  }, []);

  useEffect(() => {
    const magnifiableSelector = "button, .stat-item, .combo-badge, .score-badge, .word-chip, .analysis-card, .result-stat";
    let magnifiedElement: HTMLElement | null = null;

    function magnifyUnderPointer(event: PointerEvent) {
      if (event.pointerType === "touch") return;

      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>(magnifiableSelector)
        : null;
      if (target === magnifiedElement) return;

      magnifiedElement?.classList.remove("cursor-magnified");
      magnifiedElement = target;
      magnifiedElement?.classList.add("cursor-magnified");
    }

    function clearMagnification() {
      magnifiedElement?.classList.remove("cursor-magnified");
      magnifiedElement = null;
    }

    window.addEventListener("pointerover", magnifyUnderPointer, { passive: true });
    window.addEventListener("pointerout", magnifyUnderPointer, { passive: true });
    window.addEventListener("pointerleave", clearMagnification);
    return () => {
      window.removeEventListener("pointerover", magnifyUnderPointer);
      window.removeEventListener("pointerout", magnifyUnderPointer);
      window.removeEventListener("pointerleave", clearMagnification);
      clearMagnification();
    };
  }, []);

  useEffect(() => {
    const passage = passageRef.current;
    const currentCharacter = passage?.querySelector<HTMLElement>(".passage-character.current");
    if (!passage || !currentCharacter) return;

    const passageBounds = passage.getBoundingClientRect();
    const cursorBounds = currentCharacter.getBoundingClientRect();
    const targetCursorX = passageBounds.left + passage.clientWidth * 0.68;

    if (!isPassageFollowingRef.current && cursorBounds.right <= passageBounds.right - 48) return;

    isPassageFollowingRef.current = true;
    passage.scrollTo({
      left: passage.scrollLeft + cursorBounds.left - targetCursorX,
      behavior: "smooth",
    });
  }, [typedText, text, isFinished]);

  useEffect(() => {
    if (!isRunning || duration === 0 || timeLeft <= 0) return;

    const timer = window.setInterval(() => {
      if (timeLeft <= 1) {
        setTimeLeft(0);
        setIsRunning(false);
        setIsFinished(true);
      } else {
        setTimeLeft(timeLeft - 1);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [duration, isRunning, timeLeft]);

  function resetTest(nextDuration = duration) {
    isPassageFollowingRef.current = false;
    if (passageRef.current) passageRef.current.scrollLeft = 0;
    setInputScroll({ left: 0, top: 0 });
    characterTimesRef.current = [];
    lastKeystrokeAtRef.current = null;
    setCharacterTimes([]);
    setCombo(0);
    setRecordCombo(0);
    setDuration(nextDuration);
    setTimeLeft(nextDuration);
    setText(shuffledPassages());
    setTypedText("");
    setIsRunning(false);
    setIsFinished(false);
  }

  function handleTyping(value: string) {
    if (isFinished) return;
    const nextCharacters = Array.from(value).slice(0, characters.length);
    const previousCharacters = Array.from(typedText);
    const now = performance.now();
    const hasNewMistake = nextCharacters.some((character, index) =>
      character !== characters[index] && character !== previousCharacters[index],
    );

    if (hasNewMistake && typeof window !== "undefined" && window.AudioContext) {
      const audioContext = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = audioContext;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const soundStart = audioContext.currentTime;

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(420, soundStart);
      oscillator.frequency.exponentialRampToValueAtTime(160, soundStart + 0.2);
      gain.gain.setValueAtTime(0.0001, soundStart);
      gain.gain.exponentialRampToValueAtTime(0.2, soundStart + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, soundStart + 0.22);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(soundStart);
      oscillator.stop(soundStart + 0.23);
    }

    let nextCombo = combo;
    const wasEdited = nextCharacters.length < previousCharacters.length
      || (nextCharacters.length === previousCharacters.length
        && nextCharacters.some((character, index) => character !== previousCharacters[index]));

    if (wasEdited) {
      nextCombo = 0;
    } else {
      for (let index = previousCharacters.length; index < nextCharacters.length; index += 1) {
        if (nextCharacters[index] !== characters[index]) {
          nextCombo = 0;
          continue;
        }

        if (nextCharacters[index] === " ") {
          const wordStart = text.lastIndexOf(" ", index - 1) + 1;
          const completedWord = nextCharacters.slice(wordStart, index).join("");
          const expectedWord = characters.slice(wordStart, index).join("");
          if (completedWord && completedWord === expectedWord) nextCombo += 1;
        } else if (index === characters.length - 1) {
          const wordStart = text.lastIndexOf(" ", index - 1) + 1;
          const completedWord = nextCharacters.slice(wordStart, index + 1).join("");
          const expectedWord = characters.slice(wordStart, index + 1).join("");
          if (completedWord === expectedWord) nextCombo += 1;
        }
      }
    }

    setCombo(nextCombo);
    setRecordCombo((record) => Math.max(record, nextCombo));

    if (nextCharacters.length > previousCharacters.length) {
      for (let index = previousCharacters.length; index < nextCharacters.length; index += 1) {
        characterTimesRef.current[index] = lastKeystrokeAtRef.current === null ? 0 : (now - lastKeystrokeAtRef.current) / 1000;
      }
      lastKeystrokeAtRef.current = now;
    } else if (nextCharacters.length < previousCharacters.length) {
      characterTimesRef.current.length = nextCharacters.length;
      lastKeystrokeAtRef.current = now;
    } else {
      const changedIndex = nextCharacters.findIndex((character, index) => character !== previousCharacters[index]);
      if (changedIndex >= 0) {
        characterTimesRef.current[changedIndex] = lastKeystrokeAtRef.current === null ? 0 : (now - lastKeystrokeAtRef.current) / 1000;
        lastKeystrokeAtRef.current = now;
      }
    }

    setCharacterTimes([...characterTimesRef.current]);

    const nextValue = nextCharacters.join("");
    setTypedText(nextValue);
    if (nextCharacters.length > 0) setIsRunning(true);
    if (duration !== 0 && nextCharacters.length === characters.length) {
      setIsRunning(false);
      setIsFinished(true);
    } else if (duration === 0 && nextCharacters.length === characters.length
      && nextCharacters.every((character, index) => character === characters[index])) {
      setIsRunning(false);
      setIsFinished(true);
    }
  }

  return (
    <main className="page-shell">
      <section className="test-card" aria-label="Шивэлтийн сорил">
        <div className="test-toolbar">
          <div className="duration-picker" role="group" aria-label="Сорилын хугацаа">
            {[60, 120, 0].map((seconds) => (
              <button
                className={`duration-option ${duration === seconds ? "selected" : ""}`}
                key={seconds}
                onClick={() => resetTest(seconds)}
                type="button"
                aria-pressed={duration === seconds}
              >
                {seconds === 0 ? "Хугацаагүй" : `${seconds} сек`}
              </button>
            ))}
          </div>
          <Image className="toolbar-logo" src={logo} alt="TypeFast Speedmark" priority />
          <button className="reset-button" onClick={() => resetTest()} type="button" aria-label="Сорилыг дахин эхлүүлэх">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 9a6.5 6.5 0 1 1 .9 4.9M3.5 4.5V9h4.5" /></svg>
            Дахин эхлүүлэх
          </button>
        </div>

        <div className="stats-row" aria-live="polite">
          <div className="stat-item timer-stat">
            <span className="stat-label">{duration === 0 ? "ДАДЛАГЫН ГОРИМ" : "ҮЛДСЭН ХУГАЦАА"}</span>
            <span className={`stat-value ${duration !== 0 && timeLeft <= 10 ? "urgent" : ""}`}>
              {duration === 0 ? "∞" : timeLeft}<small>{duration === 0 ? "" : "сек"}</small>
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">ЗӨВ ҮГ</span>
            <span className="stat-value">{correctWordCount}<small>үг</small></span>
          </div>
          <div className="stat-item">
            <span className="stat-label">ЗӨВ ТЭМДЭГТ</span>
            <span className="stat-value">{correctCharacterCount}<small>тэмдэгт</small></span>
          </div>
          <div className="stat-item error-stat">
            <span className="stat-label">АЛДАА</span>
            <span className="stat-value">{errorCount}<small>үг</small></span>
          </div>
        </div>

        <div className="combo-score-row" aria-live="polite">
          <div className="combo-badge"><span aria-hidden="true">⚡</span> COMBO <strong>{combo}</strong></div>
          <div className="score-badge">РЕКОРД COMBO <strong>{recordCombo}</strong></div>
          {combo >= 5 && <span className="combo-hint">Алдаа гарвал combo тасарна — рекордоо ахиулаарай!</span>}
        </div>

        <div className="progress-track" aria-label={`Гүйцэтгэл ${Math.round(progress)} хувь`}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div
          ref={passageRef}
          className="typing-passage"
          aria-label="Шивэх үгс"
          onCopy={(event) => event.preventDefault()}
          onContextMenu={(event) => event.preventDefault()}
          onCut={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
        >
          {characters.map((character, index) => {
            const typedCharacter = typedText[index];
            const characterState = typedCharacter === undefined
              ? ""
              : typedCharacter === character ? "correct" : "incorrect";
            return (
              <span
                aria-hidden="true"
                className={`passage-character ${characterState} ${character === " " ? "space-character" : ""} ${index === typedText.length && !isFinished ? "current" : ""}`}
                key={index}
              >
                {character === " " ? "\u00a0" : character}
              </span>
            );
          })}
        </div>

        <label className="input-label" htmlFor="typing-input">
          {isFinished ? "Сорил дууслаа — дахин эхлүүлээд ахиад үзээрэй!" : isRunning ? "Үргэлжлүүлэн шивээрэй…" : "Энд шивж эхлээрэй"}
        </label>
        <div className="typing-input-wrap">
          <div aria-hidden="true" className="typing-input-highlight">
            <div
              className="typing-input-highlight-content"
              style={{ transform: `translate(${-inputScroll.left}px, ${-inputScroll.top}px)` }}
            >
              {typedCharacters.map((character, index) => (
                <span className={incorrectCharacterIndexes.has(index) ? "incorrect" : ""} key={index}>
                  {character}
                </span>
              ))}
            </div>
          </div>
          <textarea
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="typing-input"
            disabled={isFinished}
            id="typing-input"
            onChange={(event) => handleTyping(event.target.value)}
            onPaste={(event) => event.preventDefault()}
            onScroll={(event) => setInputScroll({
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
            })}
            placeholder="Дээрх үгсийг энд бичнэ…"
            spellCheck={false}
            value={typedText}
            rows={4}
          />
        </div>
        <div className="card-footnote">
          <span><kbd>Зөв</kbd> ногоон <kbd className="wrong-key">Буруу</kbd> улаан</span>
          <span>{duration === 0 ? "Хугацаагүй горим — текстээ дуустал шивээрэй" : "Цаг шивж эхлэхэд автоматаар явна"}</span>
        </div>
      </section>

      <section className="words-section" aria-live="polite">
        <div className="section-heading">
          <div>
            <span className="section-kicker">ТАНЫ АМЖИЛТ</span>
            <h2>Зөв бичсэн үгс</h2>
          </div>
          <span className="word-count">{correctWordCount} үг</span>
        </div>
        {correctWordCount > 0 ? (
          <div className="correct-words-list">
            {correctWords.map((word, index) => <span className="word-chip" key={`${index}-${word}`}>{word}</span>)}
          </div>
        ) : (
          <p className="empty-words">Зөв шивсэн үгс энд жагсана. Эхний үгээ бичиж эхлээрэй!</p>
        )}
      </section>

      {isFinished && (
        <div className="result-overlay">
          <section className="result-dialog" aria-labelledby="result-title" aria-modal="true" role="dialog">
            <div className="result-heading">
              <span className="result-icon" aria-hidden="true">✦</span>
              <div className="result-heading-copy">
                <span className="section-kicker">СОРИЛ ДУУСЛАА</span>
                <h2 id="result-title">Таны үр дүн</h2>
                <p>{duration === 0 ? "Хугацаагүй дадлага" : `${duration} секундын сорил`}</p>
              </div>
            </div>

            <div className="result-stats">
              <div className="result-stat result-stat-primary"><span>Сорилын хугацаа</span><strong>{duration === 0 ? "Хугацаагүй" : `${duration} сек`}</strong></div>
              <div className="result-stat result-stat-primary"><span>Зөв бичсэн үг</span><strong>{correctWordCount}<small> үг</small></strong></div>
              <div className="result-stat"><span>Зөв тэмдэгт</span><strong>{correctCharacterCount}<small> тэмдэгт</small></strong></div>
              <div className="result-stat result-stat-error"><span>Алдаа</span><strong className="result-error">{errorCount}<small> үг</small></strong></div>
              <div className="result-stat"><span>Хамгийн дээд combo</span><strong className="result-record">{recordCombo}</strong></div>
            </div>

            <div className="result-analysis">
              <div className="result-analysis-heading">
                <span className="analysis-heading-mark" aria-hidden="true">⌁</span>
                <div>
                  <h3>Алдааны шинжилгээ</h3>
                  <p>Дараагийн удаа сайжруулах зүйлс</p>
                </div>
              </div>
              <div className="analysis-grid">
                <div className="analysis-card">
                  <h4>Их андуурсан тэмдэгт</h4>
                  {mostConfusedCharacters.length > 0 ? (
                    <ul>{mostConfusedCharacters.map(([character, count]) => <li key={character}><span>“{character}”</span><strong>{count} алдаа</strong></li>)}</ul>
                  ) : <p>Тэмдэгтийн алдаа гараагүй байна.</p>}
                </div>
                <div className="analysis-card">
                  <h4>Алдаа гарсан үг</h4>
                  {mostMissedWords.length > 0 ? (
                    <ul>{mostMissedWords.map(([word, count]) => <li key={word}><span>{word}</span><strong>{count} удаа</strong></li>)}</ul>
                  ) : <p>Алдаатай үг алга. Сайн байна!</p>}
                </div>
                <div className="analysis-card slowest-card">
                  <h4>Хамгийн удаан шивсэн тэмдэгт</h4>
                  {slowestCharacter
                    ? <p className="slowest-result"><strong>“{slowestCharacter.character === " " ? "зай" : slowestCharacter.character}”</strong><span>{slowestCharacter.seconds.toFixed(2)} сек</span></p>
                    : <p>Хугацааг тооцоход хангалттай шивэлт алга.</p>}
                </div>
              </div>
            </div>
            <button className="result-restart" onClick={() => resetTest()} type="button">Дахин эхлүүлэх</button>
          </section>
        </div>
      )}

      <footer className="page-footer">Тайван амьсгалаад, нэг нэг үгээр урагшлаарай <span>✳</span></footer>
    </main>
  );
}