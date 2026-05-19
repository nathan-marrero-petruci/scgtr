using Microsoft.AspNetCore.Mvc;
using Api.DTOs;
using Api.Services;

namespace Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly IConfiguration _configuration;

    public AuthController(AuthService authService, IConfiguration configuration)
    {
        _authService = authService;
        _configuration = configuration;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var result = await _authService.Login(dto);
        if (result == null)
            return Unauthorized(new { message = "Email ou senha inválidos" });

        return Ok(result);
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto, [FromHeader(Name = "X-Admin-Secret")] string? secret)
    {
        var expected = _configuration["AdminSecret"];
        if (string.IsNullOrEmpty(expected) || secret != expected)
            return Unauthorized(new { message = "Não autorizado." });

        var result = await _authService.Register(dto);
        if (result == null)
            return BadRequest(new { message = "Email já cadastrado ou senha não atende os requisitos mínimos." });

        return Ok(result);
    }
}
