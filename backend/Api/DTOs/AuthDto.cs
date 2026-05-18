using System.ComponentModel.DataAnnotations;

namespace Api.DTOs;

public class RegisterDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [RegularExpression(
        @"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$",
        ErrorMessage = "A senha deve ter no mínimo 8 caracteres, letra maiúscula, minúscula, número e caractere especial."
    )]
    public string Password { get; set; } = string.Empty;
}

public class LoginDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int UserId { get; set; }
}
