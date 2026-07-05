using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Api.Models;
using Api.DTOs;

namespace Api.Services;

public class AuthService
{
    private static readonly Regex PasswordPolicy =
        new(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$", RegexOptions.Compiled);

    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<AuthResponseDto?> Register(RegisterDto dto)
    {
        if (!PasswordPolicy.IsMatch(dto.Password))
            return null;

        var email = dto.Email.Trim().ToLower();
        if (await _context.Users.AnyAsync(u => u.Email == email))
            return null;

        var referralCode = await GenerateUniqueReferralCode();
        var referredById = await ResolveReferrer(dto.ReferralCode);

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            SubscriptionStatus = "trialing",
            TrialEndsAt = DateTime.UtcNow.AddDays(14),
            ReferralCode = referralCode,
            ReferredById = referredById,
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return GenerateToken(user);
    }

    public async Task<AuthResponseDto?> Login(LoginDto dto)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == dto.Email.Trim().ToLower());

        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return null;

        return GenerateToken(user);
    }

    private async Task<string> GenerateUniqueReferralCode()
    {
        string code;
        do { code = Guid.NewGuid().ToString("N")[..8].ToUpper(); }
        while (await _context.Users.AnyAsync(u => u.ReferralCode == code));
        return code;
    }

    private async Task<int?> ResolveReferrer(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        var referrer = await _context.Users
            .FirstOrDefaultAsync(u => u.ReferralCode == code.Trim().ToUpper());
        return referrer?.Id;
    }

    private AuthResponseDto GenerateToken(User user)
    {
        var jwtKey = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.");
        if (jwtKey.Length < 32)
            throw new InvalidOperationException("Jwt:Key must be at least 32 characters.");

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds);

        return new AuthResponseDto
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            Email = user.Email,
            UserId = user.Id,
            SubscriptionStatus = user.SubscriptionStatus,
            TrialEndsAt = user.TrialEndsAt,
            ReferralCode = user.ReferralCode,
        };
    }
}
