"use client"

import { useState, useEffect, useRef } from "react"
import "./qcm.scss"
import questionsData from "./QCM.json"

// Mélange Fisher–Yates
function shuffleArray(arr) {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Compare deux tableaux d'objets question par leurs ids
function arraysEqualById(a, b) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false
  }
  return true
}

export default function QCM() {
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showExplanation, setShowExplanation] = useState(false)
  const [sessionErrors, setSessionErrors] = useState([])
  const previousSelection = useRef(null)

  // Fonction qui choisit un set aléatoire différent de l'ancien
  function pickNewQuestions() {
    let newSelection = []
    let attempts = 0
    do {
      newSelection = shuffleArray(questionsData).slice(0, 60)
      attempts++
      if (attempts > 60) break
    } while (arraysEqualById(newSelection, previousSelection.current))
    previousSelection.current = newSelection
    return newSelection
  }

  // Au démarrage, sélection initiale
  useEffect(() => {
    const initialSelection = pickNewQuestions()
    setQuestions(initialSelection)
  }, [])

  const currentQuestion = questions[index] ?? null

  function answerQuestion(choiceIdx) {
    if (!currentQuestion) return

    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: choiceIdx }))

    // Si la réponse est incorrecte, l'ajouter aux erreurs de la session
    if (choiceIdx !== currentQuestion.answer) {
      const errorData = {
        questionId: currentQuestion.id,
        domain: currentQuestion.domain,
        question: currentQuestion.question,
        choices: currentQuestion.choices,
        userAnswer: choiceIdx,
        correctAnswer: currentQuestion.answer,
        explanation: currentQuestion.explanation,
        timestamp: new Date().toISOString(),
      }

      setSessionErrors((prev) => {
        // Éviter les doublons si l'utilisateur change sa réponse
        const filtered = prev.filter((err) => err.questionId !== currentQuestion.id)
        return [...filtered, errorData]
      })
    } else {
      // Si la réponse devient correcte, retirer l'erreur
      setSessionErrors((prev) => prev.filter((err) => err.questionId !== currentQuestion.id))
    }

    setShowExplanation(true)
  }

  function next() {
    setShowExplanation(false)
    setIndex((i) => Math.min(i + 1, questions.length - 1))
  }

  function prev() {
    setShowExplanation(false)
    setIndex((i) => Math.max(i - 1, 0))
  }

  function resetQuiz() {
    const newQuestions = pickNewQuestions()
    setQuestions(newQuestions)
    setIndex(0)
    setAnswers({})
    setShowExplanation(false)
    setSessionErrors([])
  }

  // Fonction pour obtenir le prochain numéro de fichier
  function getNextFileNumber() {
    const stored = localStorage.getItem("qcm_file_counter")
    const current = stored ? Number.parseInt(stored, 60) : 0
    const next = current + 1
    localStorage.setItem("qcm_file_counter", next.toString())
    return next
  }

  // Fonction pour générer le contenu du fichier texte
  function generateErrorReport() {
    if (sessionErrors.length === 0) {
      return "Aucune erreur dans cette session ! Félicitations !"
    }

    let content = `RAPPORT D'ERREURS - QCM AZ-104\n`
    content += `Date: ${new Date().toLocaleString("fr-FR")}\n`
    content += `Nombre d'erreurs: ${sessionErrors.length}\n`
    content += `Score: ${correctCount}/${questions.length}\n`
    content += `${"=".repeat(50)}\n\n`

    sessionErrors.forEach((error, index) => {
      content += `ERREUR ${index + 1}\n`
      content += `Domaine: ${error.domain}\n`
      content += `Question: ${error.question}\n\n`

      content += `Choix disponibles:\n`
      error.choices.forEach((choice, i) => {
        const letter = String.fromCharCode(65 + i)
        const marker = i === error.correctAnswer ? " ✓ (CORRECT)" : i === error.userAnswer ? " ✗ (VOTRE RÉPONSE)" : ""
        content += `  ${letter}. ${choice}${marker}\n`
      })

      content += `\nExplication: ${error.explanation}\n`
      content += `${"─".repeat(40)}\n\n`
    })

    return content
  }

  // Fonction pour sauvegarder le fichier
  async function saveErrorReport() {
    try {
      const content = generateErrorReport()
      const fileNumber = getNextFileNumber()
      const fileName = `erreurs_qcm_${fileNumber.toString().padStart(3, "0")}.txt`

      // Créer un blob avec le contenu
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })

      // Vérifier si l'API File System Access est supportée
      if ("showSaveFilePicker" in window) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: "Fichiers texte",
                accept: { "text/plain": [".txt"] },
              },
            ],
          })

          const writable = await fileHandle.createWritable()
          await writable.write(blob)
          await writable.close()

          alert(`Fichier sauvegardé avec succès : ${fileName}`)
        } catch (err) {
          if (err.name !== "AbortError") {
            throw err
          }
        }
      } else {
        // Fallback : téléchargement classique
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        alert(`Fichier téléchargé : ${fileName}`)
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error)
      alert("Erreur lors de la sauvegarde du fichier")
    }
  }

  // Calcul du score
  const correctCount = Object.keys(answers).filter(
    (id) => answers[id] === questions.find((q) => q.id === id)?.answer,
  ).length

  return (
    <div className="quiz-wrapper">
      <div className="quiz-container">
        <header>
          <h1>AZ-104 — QCM aléatoire (60 questions)</h1>
          <div className="header-buttons">
            <button onClick={resetQuiz}>Recommencer</button>
            <button onClick={saveErrorReport} className="save-errors-btn" disabled={Object.keys(answers).length === 0}>
              Sauvegarder les erreurs ({sessionErrors.length})
            </button>
          </div>
        </header>

        {currentQuestion && (
          <div className="question-card">
            <div className="question-header">
              <span>{currentQuestion.domain}</span>
              <span>
                {index + 1} / {questions.length}
              </span>
            </div>
            <h2>{currentQuestion.question}</h2>
            <div className="choices">
              {currentQuestion.choices.map((c, i) => {
                const isSelected = answers[currentQuestion.id] === i
                const isCorrect = currentQuestion.answer === i
                const showColor = showExplanation && (isSelected || isCorrect)
                let btnClass = ""
                if (showColor) {
                  btnClass = isCorrect ? "correct" : "incorrect"
                }
                return (
                  <button key={i} onClick={() => answerQuestion(i)} className={btnClass} disabled={showExplanation}>
                    {String.fromCharCode(65 + i)}. {c}
                  </button>
                )
              })}
            </div>
            {showExplanation && <div className="explanation">{currentQuestion.explanation}</div>}
            <div className="navigation">
              <button onClick={prev} disabled={index === 0}>
                Précédent
              </button>
              <button onClick={next} disabled={index === questions.length - 1} className="primary">
                Suivant
              </button>
              <button onClick={() => setShowExplanation((s) => !s)} className="explication-btn">
                Explication
              </button>
            </div>
          </div>
        )}

        <footer>
          <div className="score-info">
            <span>
              Score : {correctCount} / {questions.length}
            </span>
            <br />
            <span>Erreurs : {sessionErrors.length}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
