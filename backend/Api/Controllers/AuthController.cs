using Microsoft.AspNetCore.Mvc;
using Api.DTOs;
using Api.Services;

namespace Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto dto)
    {
        var result = await _authService.Login(dto);
        if (result == null)
            return Unauthorized(new { message = "Email ou senha inválidos" });

        return Ok(result);
    }
}
