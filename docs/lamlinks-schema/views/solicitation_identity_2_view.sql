-- dbo.solicitation_identity_2_view



/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */

/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */


/* view solicitation_identity_2_view: add view */
CREATE VIEW [dbo].[solicitation_identity_2_view]
AS
SELECT DISTINCT dbo.solicitation_identity_1_view.idnk11_k11 AS idnk11_frm, dbo.kc4_tab.idnkc4_kc4, dbo.k11_tab.idnk11_k11
FROM         dbo.solicitation_identity_1_view INNER JOIN
                      dbo.kc4_tab ON dbo.solicitation_identity_1_view.idnkc4_kc4 = dbo.kc4_tab.idnkc4_kc4 INNER JOIN
                      dbo.k11_tab ON dbo.kc4_tab.idnk08_kc4 = dbo.k11_tab.idnk08_k11 AND dbo.kc4_tab.idnk10_kc4 = dbo.k11_tab.idnk10_k11


















