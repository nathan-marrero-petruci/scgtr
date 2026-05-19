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
    
    // Relacionamento - adicione [JsonIgnore] para evitar loop
    [JsonIgnore]
    public ICollection<Ganho> Ganhos { get; set; } = new List<Ganho>();
}