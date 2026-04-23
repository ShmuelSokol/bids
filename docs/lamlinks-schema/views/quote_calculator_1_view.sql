-- dbo.quote_calculator_1_view



/* view quote_calculator_1_view: add view */


/* view quote_calculator_1_view: add view */


/* view quote_calculator_1_view: add view */

/* view quote_calculator_1_view: add view */


/* view quote_calculator_1_view: add view */


/* view quote_calculator_1_view: add view */
CREATE VIEW [dbo].[quote_calculator_1_view]
AS
SELECT        K34_TAB.uptime_k34, K11_TAB.idnk11_k11, K34_TAB.idnk34_k34, dbo.solicitation_identity_1_view.idnkc4_kc4, dbo.k10_tab.sol_no_k10, dbo.kah_tab.a_note_kah
FROM            dbo.k34_tab AS K34_TAB INNER JOIN
                         dbo.k11_tab AS K11_TAB ON K34_TAB.idnk11_k34 = K11_TAB.idnk11_k11 INNER JOIN
                         dbo.solicitation_identity_1_view ON K11_TAB.idnk11_k11 = dbo.solicitation_identity_1_view.idnk11_k11 INNER JOIN
                         dbo.k10_tab ON K11_TAB.idnk10_k11 = dbo.k10_tab.idnk10_k10 INNER JOIN
                         dbo.kah_tab ON dbo.solicitation_identity_1_view.idnkc4_kc4 = dbo.kah_tab.idnanu_kah
WHERE        (dbo.kah_tab.anutbl_kah = 'kc4') AND (dbo.kah_tab.anutyp_kah = 'xml_quote_calculator')






