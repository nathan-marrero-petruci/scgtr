using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Api.Models;

public class User
{
    [Key]
    public int Id { get; set; }

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? StripeCustomerId { get; set; }
    public string SubscriptionStatus { get; set; } = "trialing";
    public DateTime? SubscriptionEndsAt { get; set; }
    public DateTime TrialEndsAt { get; set; } = DateTime.UtcNow.AddDays(14);
    public string? ReferralCode { get; set; }
    public int? ReferredById { get; set; }
    public int ReferralCredits { get; set; } = 0;
    public string? ReferralMonth { get; set; }
    public int ReferralCountMonth { get; set; } = 0;

    [JsonIgnore]
    public ICollection<Ganho> Ganhos { get; set; } = new List<Ganho>();
}
