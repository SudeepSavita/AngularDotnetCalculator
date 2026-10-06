using Microsoft.AspNetCore.Mvc;
using System.Data;
using System.Text.RegularExpressions;

namespace ScientificCalculator.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CalculatorController : ControllerBase
{
    [HttpPost("evaluate")]
    public IActionResult Evaluate([FromBody] EvaluateRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.Expression))
                return Ok(new { result = (string?)null, error = "Empty" });

            var expr = PreProcess(req.Expression, req.IsDegrees);
            var result = EvaluateFinal(expr);

            // Guard against unusable results
            if (double.IsNaN(result))
                return Ok(new { result = (string?)null, error = "Format Error" });
            if (double.IsInfinity(result))
                return Ok(new { result = (string?)null, error = "Format Error" });
            if (Math.Abs(result) > 1e99)
                return Ok(new { result = (string?)null, error = "Format Error" });

            return Ok(new { result = FormatResult(result), error = (string?)null });
        }
        catch
        {
            return Ok(new { result = (string?)null, error = "Format Error" });
        }
    }

    private static string PreProcess(string expr, bool isDegrees)
    {
        expr = expr.Trim();

        // Constants
        expr = Regex.Replace(expr, @"\bpi\b", Math.PI.ToString("R"), RegexOptions.IgnoreCase);
        expr = expr.Replace("π", Math.PI.ToString("R"));
        expr = Regex.Replace(expr, @"\be\b", Math.E.ToString("R"));

        // Factorial: n! → computed value (max 20)
        expr = Regex.Replace(expr, @"(\d+(?:\.\d+)?)!", m =>
        {
            double d = double.Parse(m.Groups[1].Value);
            if (d != Math.Floor(d) || d < 0 || d > 20)
                throw new ArgumentException("Factorial invalid");
            return Factorial((long)d).ToString();
        });

        // Trig inverse
        expr = ApplyFunc(expr, "asin", x => { ValidateTrigInv(x); return Math.Asin(x); });
        expr = ApplyFunc(expr, "acos", x => { ValidateTrigInv(x); return Math.Acos(x); });
        expr = ApplyFunc(expr, "atan", x => Math.Atan(x));

        // Trig
        if (isDegrees)
        {
            expr = ApplyFunc(expr, "sin", x => Math.Sin(x * Math.PI / 180.0));
            expr = ApplyFunc(expr, "cos", x => Math.Cos(x * Math.PI / 180.0));
            expr = ApplyFunc(expr, "tan", x =>
            {
                double r = x * Math.PI / 180.0;
                double val = Math.Tan(r);
                if (double.IsInfinity(val)) throw new DivideByZeroException();
                return val;
            });
        }
        else
        {
            expr = ApplyFunc(expr, "sin", x => Math.Sin(x));
            expr = ApplyFunc(expr, "cos", x => Math.Cos(x));
            expr = ApplyFunc(expr, "tan", x => Math.Tan(x));
        }

        expr = ApplyFunc(expr, "sqrt", x =>
        {
            if (x < 0) throw new ArgumentException("sqrt of negative");
            return Math.Sqrt(x);
        });
        expr = ApplyFunc(expr, "ln",  x =>
        {
            if (x <= 0) throw new ArgumentException("ln of non-positive");
            return Math.Log(x);
        });
        expr = ApplyFunc(expr, "log", x =>
        {
            if (x <= 0) throw new ArgumentException("log of non-positive");
            return Math.Log10(x);
        });

        // Power: a^b — limit exponent to prevent overflow
        expr = HandlePower(expr);

        return expr;
    }

    private static void ValidateTrigInv(double x)
    {
        if (x < -1 || x > 1) throw new ArgumentException("asin/acos domain error");
    }

    private static string ApplyFunc(string expr, string fname, Func<double, double> fn)
    {
        int limit = 50; // max iterations safety
        while (limit-- > 0)
        {
            int idx = expr.IndexOf(fname + "(", StringComparison.OrdinalIgnoreCase);
            if (idx < 0) break;
            int start = idx + fname.Length + 1;
            int depth = 1, i = start;
            while (i < expr.Length && depth > 0)
            {
                if (expr[i] == '(') depth++;
                else if (expr[i] == ')') depth--;
                i++;
            }
            if (depth != 0) throw new FormatException("Unbalanced parens");
            var inner = expr.Substring(start, i - start - 1);
            if (string.IsNullOrWhiteSpace(inner)) throw new FormatException("Empty function arg");
            double innerVal = EvaluateSimple(inner);
            double res = fn(innerVal);
            if (double.IsNaN(res) || double.IsInfinity(res))
                throw new ArithmeticException("Math domain error");
            expr = expr.Substring(0, idx) + res.ToString("R") + expr.Substring(i);
        }
        return expr;
    }

    private static string HandlePower(string expr)
    {
        int limit = 30;
        while (expr.Contains('^') && limit-- > 0)
        {
            var m = Regex.Match(expr, @"([\d\.]+)\^([\d\.]+)");
            if (!m.Success) break;
            double b = double.Parse(m.Groups[1].Value);
            double e = double.Parse(m.Groups[2].Value);
            // Safety: prevent astronomically large results
            if (e > 300) throw new OverflowException("Exponent too large");
            double res = Math.Pow(b, e);
            if (double.IsInfinity(res) || double.IsNaN(res))
                throw new OverflowException("Power overflow");
            expr = expr.Substring(0, m.Index) + res.ToString("R") + expr.Substring(m.Index + m.Length);
        }
        return expr;
    }

    private static double EvaluateSimple(string expr)
    {
        expr = PreProcess(expr, true);
        var result = new DataTable().Compute(expr, null);
        return Convert.ToDouble(result);
    }

    private static double EvaluateFinal(string expr)
    {
        if (string.IsNullOrWhiteSpace(expr)) throw new FormatException("Empty");
        var result = new DataTable().Compute(expr, null);
        return Convert.ToDouble(result);
    }

    private static long Factorial(long n)
    {
        long r = 1;
        for (long i = 2; i <= n; i++) r *= i;
        return r;
    }

    private static string FormatResult(double v)
    {
        if (v == Math.Floor(v) && Math.Abs(v) < 1e15)
            return ((long)v).ToString();
        return v.ToString("G10");
    }
}

public record EvaluateRequest(string Expression, bool IsDegrees = true);
