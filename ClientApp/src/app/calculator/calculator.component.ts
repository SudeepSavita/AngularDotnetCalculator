import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface CalcResponse {
  result: string | null;
  error: string | null;
}

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css']
})
export class CalculatorComponent implements OnInit, OnDestroy {
  expression = '';
  result = '';
  isFormatError = false;
  justEvaluated = false;
  currentTime = '';
  private timer: any;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.updateTime();
    this.timer = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private updateTime(): void {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    this.currentTime = `${h}:${m}`;
  }

  private isOperator(v: string): boolean {
    return ['+', '-', '*', '/', '^'].includes(v);
  }

  // ── Frontend validation before sending to API ──────────────────
  private validate(expr: string): string | null {
    if (!expr.trim()) return 'Empty expression';

    // Check unbalanced parentheses
    let depth = 0;
    for (const ch of expr) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth < 0) return 'Format Error';
    }
    if (depth !== 0) return 'Format Error';

    // Empty parens ()
    if (/\(\s*\)/.test(expr)) return 'Format Error';

    // Operator at very start (except minus for negation)
    if (/^[+*\/\^]/.test(expr)) return 'Format Error';

    // Operator at end
    if (/[+\-*\/\^]$/.test(expr)) return 'Format Error';

    // Two operators in a row (anything other than allowed negation like *-)
    if (/[+\-*\/\^]{2,}/.test(expr.replace(/\(\-/g, '('))) return 'Format Error';

    // dot without digit: .5 is ok, but standalone dot or ..
    if (/\.\D|\.\s*$|[^\d]\.(?![0-9])/.test(expr)) return 'Format Error';

    // Function called without argument: sin(), cos() etc.
    if (/\b(sin|cos|tan|log|ln|sqrt|asin|acos|atan)\(\s*\)/.test(expr)) return 'Format Error';

    // Exponent chain safety: more than 4 consecutive ^n blocks → too large
    const powerChain = expr.match(/(\^\d+(\.\d+)?){5,}/);
    if (powerChain) return 'Format Error';

    // Deeply nested parens > 10
    let maxDepth = 0, d = 0;
    for (const ch of expr) {
      if (ch === '(') { d++; maxDepth = Math.max(maxDepth, d); }
      else if (ch === ')') d--;
    }
    if (maxDepth > 10) return 'Format Error';

    return null; // valid
  }

  press(value: string): void {
    // Clear format error on new input
    if (this.isFormatError) {
      this.isFormatError = false;
      this.result = '';
    }

    if (this.justEvaluated) {
      if (this.isOperator(value)) {
        this.expression = this.result + value;
      } else {
        this.expression = value;
      }
      this.result = '';
      this.justEvaluated = false;
    } else {
      const last = this.expression.slice(-1);

      // Operator after operator → replace
      if (this.isOperator(value) && this.isOperator(last)) {
        this.expression = this.expression.slice(0, -1) + value;
        return;
      }

      // ! only after digit or )
      if (value === '!') {
        if (!/[\d)]/.test(last) || last === '!') return;
      }

      // No operator (except -) right after (
      if (this.isOperator(value) && value !== '-' && last === '(') return;

      // No double dot
      if (value === '.') {
        const seg = this.expression.split(/[+\-*\/()]/).pop() ?? '';
        if (seg.includes('.')) return;
      }

      // Don't allow ) if no matching (
      if (value === ')') {
        const opens = (this.expression.match(/\(/g) || []).length;
        const closes = (this.expression.match(/\)/g) || []).length;
        if (closes >= opens) return;
      }

      this.expression += value;
    }
  }

  clear(): void {
    this.expression = '';
    this.result = '';
    this.isFormatError = false;
    this.justEvaluated = false;
  }

  backspace(): void {
    if (this.justEvaluated) { this.clear(); return; }
    this.isFormatError = false;
    this.expression = this.expression.slice(0, -1);
    this.result = '';
  }

  calculate(): void {
    if (!this.expression.trim()) return;

    // Frontend validation first
    const validationError = this.validate(this.expression);
    if (validationError) {
      this.result = validationError;
      this.isFormatError = true;
      return;
    }

    this.http.post<CalcResponse>('/api/calculator/evaluate', {
      expression: this.expression,
      isDegrees: true
    }).subscribe({
      next: (resp) => {
        if (resp.error || !resp.result) {
          this.result = 'Format Error';
          this.isFormatError = true;
        } else {
          this.result = resp.result;
          this.isFormatError = false;
          this.justEvaluated = true;
        }
      },
      error: () => {
        this.result = 'Format Error';
        this.isFormatError = true;
      }
    });
  }

  get displayExpr(): string {
    return this.expression || '0';
  }

  @HostListener('document:keydown', ['$event'])
  handleKey(e: KeyboardEvent): void {
    const k = e.key;
    if (k >= '0' && k <= '9') { this.press(k); return; }
    if (['+', '-', '*', '/', '.', '(', ')'].includes(k)) { this.press(k); return; }
    if (k === 'Enter' || k === '=') { e.preventDefault(); this.calculate(); return; }
    if (k === 'Backspace') { this.backspace(); return; }
    if (k === 'Escape') { this.clear(); return; }
    if (k === '^') { this.press('^'); return; }
  }
}
