-- dbo.solicitation_far_clause_1_view



/* view solicitation_far_clause_1_view: add view */


/* view solicitation_far_clause_1_view: add view */


/* view solicitation_far_clause_1_view: add view */

/* view solicitation_far_clause_1_view: add view */


/* view solicitation_far_clause_1_view: add view */
CREATE VIEW dbo.solicitation_far_clause_1_view
AS
SELECT        dbo.k10_tab.sol_no_k10, dbo.kec_tab.fartyp_kec, dbo.kec_tab.farcls_kec, dbo.kec_tab.farttl_kec, dbo.k10_tab.idnk10_k10, dbo.kau_tab.idnkau_kau, dbo.kec_tab.idnkec_kec
FROM            dbo.k10_tab INNER JOIN
                         dbo.kau_tab ON dbo.k10_tab.idnk10_k10 = dbo.kau_tab.idngx1_kau INNER JOIN
                         dbo.kec_tab ON dbo.kau_tab.idngx2_kau = dbo.kec_tab.idnkec_kec
WHERE        (dbo.kau_tab.gx1tbl_kau = 'k10') AND (dbo.kau_tab.gx2tbl_kau = 'kec')





