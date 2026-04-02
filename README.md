# SubsidyScore AI

**Merit-based scoring system for agricultural subsidies in Kazakhstan**

Hackathon: **Decentrathon 5.0** | Track: **AI inDrive** | Case 2: Скоринг сельхозпроизводителей при получении субсидий

---

## Проблема

Сельскохозяйственные субсидии в Казахстане распределяются через ГИСС (subsidy.plem.kz) по принципу **FIFO** — кто первый подал заявку, тот первый получил. Этот подход не оценивает качество и обоснованность заявок.

**Реальные цифры** (на данных 2025 года):
- При FIFO-подходе средний Merit-скор топ-1000 заявок: **77.3**
- При Merit-подходе средний скор топ-1000 заявок: **93.9** (+21.5%)
- В топ-1000 по FIFO попадают **40 заявок** со средним/высоким риском
- В топ-1000 по Merit — **0 рисковых** заявок

## Решение

AI-система, которая:
1. Анализирует **36,651** заявок на субсидии из ГИСС (2025 год)
2. Извлекает **23 признака** в 5 группах (финансовые, временные, региональные, категориальные, конкурентные)
3. Обучает **ансамбль из 3 моделей** (GradientBoosting + RandomForest + LogisticRegression)
4. Вычисляет **композитный Merit Score** = 0.3×Efficiency + 0.2×Reliability + 0.2×Need + 0.3×ML
5. Объясняет каждый скор с разбивкой по компонентам (Explainability)
6. Генерирует рейтинг для комиссии (**Human-in-the-Loop** — AI рекомендует, человек решает)

## Архитектура

```
                    +-------------------+
                    |   ГИСС Данные     |
                    |   (36,651 заявок) |
                    +--------+----------+
                             |
                    +--------v----------+
                    |  Preprocessing    |
                    |  23 признака      |
                    |  LOO-кодирование  |
                    +--------+----------+
                             |
                +------------+------------+
                |            |            |
         +------v---+ +-----v----+ +-----v-----+
         | Gradient | | Random   | | Logistic  |
         | Boosting | | Forest   | | Regression|
         | w=0.5    | | w=0.3    | | w=0.2     |
         +------+---+ +-----+----+ +-----+-----+
                |            |            |
                +-----+------+------+-----+
                      |  Ensemble   |
                      +------+------+
                             |
                    +--------v----------+
                    |  Merit Scorer     |
                    |  Efficiency  0.3  |
                    |  Reliability 0.2  |
                    |  Need        0.2  |
                    |  ML Score    0.3  |
                    +--------+----------+
                             |
                +------------+------------+
                |                         |
       +--------v----------+    +--------v----------+
       |  Ranking +        |    |  FIFO vs Merit    |
       |  Explainability   |    |  сравнение        |
       +-------------------+    +-------------------+
```

## Данные

- **Источник**: ГИСС (subsidy.plem.kz), обезличенная выгрузка
- **Объём**: 36,651 заявок, период: январь 2025 — март 2026
- **Колонки**: date, region (18), district (192), direction (9), subsidy_name (45+), status (6), normative, amount
- **Target**: Одобрена/Исполнена/Получена/Сформировано поручение (86.4%) vs Отклонена/Отозвана (13.6%)

## Feature Engineering (23 признака, 5 групп)

| Группа | Признаки | Описание |
|--------|----------|----------|
| Финансовые (6) | log_amount, log_normative, log_estimated_units, amount_vs_regional_median, amount_vs_category_median, is_large_request | Анализ размера запроса |
| Временные (7) | month, quarter, day_of_week, hour, is_working_hours, is_weekday, submission_speed | Паттерны времени подачи |
| Региональные (3) | region_application_count, district_application_count, region_approval_rate | Региональная статистика |
| Категориальные (3) | direction_approval_rate, category_approval_rate, subsidy_category | Паттерны по типам субсидий |
| Кодированные (4) | region_enc, direction_enc, subsidy_category_enc, district_enc | Label-encoded категориальные |

**Защита от data leakage**: Approval rate признаки используют **leave-one-out encoding** — для каждой строки рейт считается без учёта самой этой строки.

## Модели (5-fold Stratified CV)

| Модель | AUC | Accuracy | F1 | Precision | Recall | Вес |
|--------|-----|----------|-----|-----------|--------|-----|
| GradientBoosting | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.5 |
| RandomForest | 1.0000 | 0.9992 | 0.9995 | 0.9991 | 1.0000 | 0.3 |
| LogisticRegression | 0.6705 | 0.8643 | 0.9272 | 0.8645 | 0.9997 | 0.2 |

## Композитный Merit Score

```
MERIT = 0.3 × Efficiency + 0.2 × Reliability + 0.2 × Need + 0.3 × ML_Score
```

| Компонент | Вес | Что оценивает |
|-----------|-----|---------------|
| **Efficiency** | 0.3 | Адекватность запроса нормативам категории (deviation от медианы) |
| **Reliability** | 0.2 | Паттерны подачи: рабочие часы (+15), рабочий день (+10), ранняя подача (+15) |
| **Need** | 0.2 | Потребность региона: меньше субсидий → выше (+30), совпадение специализации (+20) |
| **ML Score** | 0.3 | Ансамблевая вероятность одобрения [0-100] |

Средний Merit Score: **72.98** | Рекомендовано: **21,633** из 36,651 (59.0%)

## FIFO vs Merit

| Метрика | FIFO (по дате) | Merit (по скору) | Разница |
|---------|----------------|-------------------|---------|
| Средний скор топ-1000 | 77.3 | 93.9 | **+21.5%** |
| Рекомендовано в топ-1000 | 741 | 1000 | +259 |
| Средний/высокий риск в топ-1000 | 40 | 0 | **-40** |

## API

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/` | GET | Health check |
| `/api/stats` | GET | Общая статистика |
| `/api/ranking` | GET | Рейтинг с фильтрами (region, direction, min_score, limit, offset) |
| `/api/explain/{id}` | GET | Объяснение скора заявки |
| `/api/score` | POST | Скоринг одной заявки |
| `/api/model/info` | GET | Информация о моделях |
| `/api/features` | GET | Feature importance |

## Быстрый старт

```bash
# Установка зависимостей
pip install -r requirements.txt

# Запуск полного pipeline
python src/pipeline.py

# Запуск API
python src/api.py

# Запуск тестов
pytest tests/ -v
```

## Структура проекта

```
subsidy-scoring/
├── data/                    # Выгрузка ГИСС (xlsx)
├── src/
│   ├── preprocessing.py     # Загрузка, очистка, feature engineering
│   ├── model.py             # ML модели, обучение, explainability
│   ├── scoring.py           # Композитный merit scorer
│   ├── pipeline.py          # Главный pipeline (одна команда)
│   └── api.py               # FastAPI сервер
├── dashboard/
│   └── app.jsx              # React дашборд (5 вкладок)
├── outputs/                 # Результаты pipeline
│   ├── ranking.csv          # Рейтинг 36,651 заявок
│   ├── dashboard_data.json  # Данные для дашборда
│   ├── model_results.json   # CV-метрики моделей
│   └── feature_importance.csv
├── tests/
│   └── test_pipeline.py     # Unit-тесты
├── README.md
├── ARCHITECTURE.md
├── requirements.txt
├── Dockerfile
└── .gitignore
```

## Ограничения

- Данные обезличены — нет признаков идентичности заявителя
- Только исторические данные (2025) — нет temporal validation
- Нет внешних источников (погода, рыночные цены, размер хозяйства)
- Высокий AUC у tree-based моделей обусловлен сильной корреляцией approval rate с таргетом (даже с LOO-encoding)
- Снимок одного года — модель может не обобщаться при изменениях политики

## Дальнейшие шаги

- Интеграция с ГИСС API для real-time скоринга
- Добавление внешних данных: погода, спутниковые снимки, рыночные цены
- Temporal validation с данными 2024 года
- A/B тестирование против текущей FIFO-системы
- Fairness audit по регионам и размерам хозяйств
- Мультиязычный интерфейс (казахский, русский, английский)
